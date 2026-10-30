import { nodeAuthHeader } from "@/lib/node-token";

// Client helpers for the obs-instance-manager media file-manager API
// (/instances/:id/files*). Each request carries a fresh "files" node token for
// this one instance, same as instance-actions.ts; apiUrl is the resolved node
// URL for the instance.

export interface MediaFile {
  path: string;
  size: number;
  modified: string;
}

export interface MediaListing {
  files: MediaFile[];
  used_bytes: number;
  quota_bytes: number;
}

function authHeader(instanceId: string): Promise<string> {
  return nodeAuthHeader(instanceId, "files");
}

function base(apiUrl: string, instanceId: string): string {
  return `${apiUrl.replace(/\/$/, "")}/instances/${instanceId}/files`;
}

export async function listMediaFiles(apiUrl: string, instanceId: string): Promise<MediaListing> {
  const res = await fetch(base(apiUrl, instanceId), { headers: { Authorization: await authHeader(instanceId) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to list files (${res.status})`);
  }
  return (await res.json()) as MediaListing;
}

// Uploads one file, streaming its bytes as the raw request body with the
// target path in the x-file-path header. Uses XHR so we can report real
// progress; onProgress receives 0..100.
export function uploadMediaFile(
  apiUrl: string,
  instanceId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<MediaListing> {
  return new Promise(async (resolve, reject) => {
    let auth: string;
    try {
      auth = await authHeader(instanceId);
    } catch (err) {
      reject(err);
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", base(apiUrl, instanceId));
    xhr.setRequestHeader("Authorization", auth);
    xhr.setRequestHeader("x-file-path", file.name);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as MediaListing);
      } else {
        let msg = `Upload failed (${xhr.status})`;
        try {
          msg = JSON.parse(xhr.responseText).error ?? msg;
        } catch {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed: network error"));
    xhr.send(file);
  });
}

// Returns scene_reference_warning: true when the rename may have broken an
// OBS scene source pointing at the old absolute path.
export async function renameMediaFile(
  apiUrl: string,
  instanceId: string,
  from: string,
  to: string,
): Promise<{ scene_reference_warning: boolean }> {
  const res = await fetch(`${base(apiUrl, instanceId)}/rename`, {
    method: "PATCH",
    headers: { Authorization: await authHeader(instanceId), "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to rename file (${res.status})`);
  }
  return (await res.json()) as { scene_reference_warning: boolean };
}

export async function deleteMediaFile(apiUrl: string, instanceId: string, path: string): Promise<MediaListing> {
  const res = await fetch(base(apiUrl, instanceId), {
    method: "DELETE",
    headers: { Authorization: await authHeader(instanceId), "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to delete file (${res.status})`);
  }
  return (await res.json()) as MediaListing;
}
