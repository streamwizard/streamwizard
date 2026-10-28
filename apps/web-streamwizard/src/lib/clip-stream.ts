/**
 * Input checks for the clip preview proxy (/api/overlays/preview/stream).
 *
 * The proxy used to take a raw `url` and fetch it, which let any signed-in
 * user make the server fetch anything (SSRF). It now takes a Twitch clip id,
 * resolves the signed MP4 URL itself through Helix (scoped to the caller's
 * clips), and only then fetches. These helpers keep both ends narrow.
 */

/** Twitch clip ids are slugs: letters, digits, `-` and `_`. */
const CLIP_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function isTwitchClipId(value: string | null | undefined): value is string {
  return typeof value === "string" && CLIP_ID.test(value);
}

/**
 * The signed URL comes from Helix, but check it anyway before the server
 * fetches it: https, default port, no credentials.
 */
export function parseClipVideoUrl(raw: string | null | undefined): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    return url;
  } catch {
    return null;
  }
}
