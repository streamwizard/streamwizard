import { slugify } from "@repo/cms";

// Upload rules for CMS images. Pure, so the browser can check a file before
// asking for an upload URL and the server can check the same things again.

export const CMS_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
} as const;

export type CmsImageType = keyof typeof CMS_IMAGE_TYPES;

export type CmsUploadPurpose = "content" | "avatar";

export const MAX_CONTENT_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const MAX_ALT_LENGTH = 300;
const MAX_DIMENSION = 12_000;

export function isCmsImageType(type: string): type is CmsImageType {
  return Object.hasOwn(CMS_IMAGE_TYPES, type);
}

export interface CmsUploadRequest {
  fileName: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  alt: string;
  decorative: boolean;
  purpose: CmsUploadPurpose;
}

/** The first problem with an upload, as a message for the admin, or null. */
export function validateCmsUpload(request: CmsUploadRequest): string | null {
  if (!isCmsImageType(request.mimeType)) return "Use a JPG, PNG, WebP, AVIF or GIF image. SVG isn't allowed.";
  const max = request.purpose === "avatar" ? MAX_AVATAR_BYTES : MAX_CONTENT_IMAGE_BYTES;
  if (!Number.isInteger(request.size) || request.size <= 0) return "That file is empty.";
  if (request.size > max) return `That image is too big. The limit is ${max / (1024 * 1024)} MB.`;
  for (const side of [request.width, request.height]) {
    if (!Number.isInteger(side) || side <= 0 || side > MAX_DIMENSION)
      return "Couldn't read the image size. Try another file.";
  }
  const alt = request.alt.trim();
  if (!request.decorative && !alt) return "Add alt text: describe what the image shows, or mark it as decorative.";
  if (alt.length > MAX_ALT_LENGTH) return `Keep alt text under ${MAX_ALT_LENGTH} characters.`;
  return null;
}

// cms/2026/10/<id>/obs-output-settings.png. The id makes every key unique, so
// an object is never overwritten and the CDN can cache it forever.
export function cmsAssetKey(id: string, fileName: string, mimeType: CmsImageType, now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const base = slugify(fileName.replace(/\.[a-z0-9]{1,5}$/i, ""), 60) || "image";
  return `cms/${year}/${month}/${id}/${base}.${CMS_IMAGE_TYPES[mimeType]}`;
}

/** "obs-output-settings.png" for showing a key in the media library. */
export function cmsAssetFileName(key: string): string {
  return key.slice(key.lastIndexOf("/") + 1);
}
