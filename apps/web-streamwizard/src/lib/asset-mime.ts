// Media library file types. Shared by the upload server action and its tests;
// kept out of actions/assets.ts because a "use server" module may only export
// async functions.

export type AssetKind = "image" | "audio" | "video" | "lottie" | "font";

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
  // Fonts for overlay text (SW-241). Overlays load them with @font-face.
  "font/woff2": "font",
  "font/woff": "font",
};

// Browsers and OSes don't agree on a few audio types (Chrome on Windows
// reports WAV as audio/x-wav). Normalise only for the kind lookup; the row and
// the signed URL keep the original type, because that's what the browser sends.
const MIME_ALIASES: Record<string, string> = {
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/vnd.wave": "audio/wav",
  "audio/mp3": "audio/mpeg",
  "application/font-woff": "font/woff",
  "application/x-font-woff": "font/woff",
  "application/font-woff2": "font/woff2",
};

export function kindFromMime(mime: string): AssetKind | null {
  const normalised = mime.toLowerCase();
  return MIME_TO_KIND[MIME_ALIASES[normalised] ?? normalised] ?? null;
}

// Plenty of systems have no type registered for web fonts, so the browser
// hands over "" or application/octet-stream. Only fonts are guessed from the
// extension; every other kind still needs a type the browser vouches for.
const FONT_EXTENSIONS: Record<string, string> = {
  woff2: "font/woff2",
  woff: "font/woff",
};

/** The type to upload `file` as: the browser's, or a font's from its extension. */
export function uploadMimeType(file: { name: string; type: string }): string {
  if (kindFromMime(file.type)) return file.type;
  const ext = file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase();
  const font = FONT_EXTENSIONS[ext];
  return font && (file.type === "" || file.type === "application/octet-stream") ? font : file.type;
}
