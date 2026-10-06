// Media library file types. Shared by the upload server action and its tests;
// kept out of actions/assets.ts because a "use server" module may only export
// async functions.

export type AssetKind = "image" | "audio" | "video" | "lottie";

// Explicit allowlist — never prefix-match. image/svg+xml is deliberately
// excluded: SVG can carry <script> and the CDN domain is same-site with the
// dashboard, so a stored SVG would be a stored-XSS vector. presignPut signs the
// Content-Type and Content-Length, so clients can't swap the type or grow the
// file after this check; confirmAssetUpload re-checks both against R2.
const MIME_TO_KIND: Record<string, AssetKind> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/avif": "image",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "audio/ogg": "audio",
  "audio/webm": "audio",
  "video/mp4": "video",
  "video/webm": "video",
  "application/json": "lottie",
};

// Browsers and OSes don't agree on a few audio types (Chrome on Windows
// reports WAV as audio/x-wav). Normalise only for the kind lookup; the row and
// the signed URL keep the original type, because that's what the browser sends.
const MIME_ALIASES: Record<string, string> = {
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/vnd.wave": "audio/wav",
  "audio/mp3": "audio/mpeg",
};

export function kindFromMime(mime: string): AssetKind | null {
  const normalised = mime.toLowerCase();
  return MIME_TO_KIND[MIME_ALIASES[normalised] ?? normalised] ?? null;
}
