import { confirmCmsUploadAction, createCmsUploadAction } from "@/actions/cms-media";
import { validateCmsUpload, type CmsUploadPurpose } from "@/lib/cms/media";
import type { CmsMediaItem } from "@/lib/cms/media-items";

// Browser side of a CMS image upload: read the size, ask for a presigned URL,
// PUT the file straight to R2 (XHR for real progress), confirm.

/** Natural size of an image file, read by the browser that will upload it. */
export function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      reject(new Error("Couldn't read that image. Try another file."));
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

function putToPresignedUrl(url: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 answered ${xhr.status}`));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(file);
  });
}

export interface UploadOptions {
  alt: string;
  decorative: boolean;
  purpose: CmsUploadPurpose;
  onProgress?: (percent: number) => void;
}

export async function uploadCmsImage(
  file: File,
  options: UploadOptions,
): Promise<{ error: string | null; asset: CmsMediaItem | null }> {
  let size: { width: number; height: number };
  try {
    size = await readImageSize(file);
  } catch (error) {
    return { error: (error as Error).message, asset: null };
  }
  const request = {
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    width: size.width,
    height: size.height,
    alt: options.alt,
    decorative: options.decorative,
    purpose: options.purpose,
  };
  const problem = validateCmsUpload(request);
  if (problem) return { error: problem, asset: null };

  const created = await createCmsUploadAction(request);
  if (created.error || !created.upload) return { error: created.error ?? "Couldn't start the upload.", asset: null };
  try {
    await putToPresignedUrl(created.upload.url, file, options.onProgress ?? (() => {}));
  } catch {
    return { error: "The upload didn't go through. Check your connection and try again.", asset: null };
  }
  return confirmCmsUploadAction(created.upload.id);
}
