/**
 * A font the streamer uploaded to the media library, stored wherever a widget
 * keeps a Google font family: `sw-font:` plus the file's CDN URL. Every
 * renderer already writes `font-family: "<family>", sans-serif`, and a quoted
 * family can be any string, so the ref itself is the family name. The loader
 * declares it with an `@font-face` pointing at the URL instead of asking
 * Google for it.
 *
 * A file deleted from the library leaves the ref behind; its `@font-face`
 * fails to load and the text falls back to sans-serif.
 */

export const UPLOADED_FONT_PREFIX = "sw-font:";

// The media library only writes keys like assets/<user>/<id>/<file>, with the
// file name cleaned to [a-zA-Z0-9._-]. Anything else here could end the CSS
// string or the url() the ref is written into, so it is refused outright.
const UPLOADED_FONT_REF =
  /^sw-font:(https?:\/\/[a-z0-9.-]+(?::\d+)?\/[a-z0-9._~/-]+\.(woff2?))$/i;

export function isUploadedFontRef(value: string): boolean {
  return UPLOADED_FONT_REF.test(value);
}

/** The ref for a media library URL, or null when it isn't a .woff/.woff2 file. */
export function uploadedFontRef(url: string): string | null {
  const ref = `${UPLOADED_FONT_PREFIX}${url}`;
  return isUploadedFontRef(ref) ? ref : null;
}

export function uploadedFontUrl(ref: string): string | null {
  return UPLOADED_FONT_REF.exec(ref)?.[1] ?? null;
}

/** A readable name for the picker: the file name, minus its extension. */
export function uploadedFontName(ref: string): string {
  const url = uploadedFontUrl(ref);
  if (!url) return ref;
  const file = url.slice(url.lastIndexOf("/") + 1).replace(/\.woff2?$/i, "");
  return file.replace(/[-_]+/g, " ").trim() || "Your font";
}

/**
 * The `@font-face` rule that makes `ref` usable as a family. One file covers
 * every weight, so bold uses the file as drawn instead of a faked bold.
 */
export function uploadedFontFaceCss(ref: string): string | null {
  const m = UPLOADED_FONT_REF.exec(ref);
  if (!m) return null;
  const format = m[2]!.toLowerCase() === "woff2" ? "woff2" : "woff";
  return `@font-face{font-family:"${ref}";src:url("${m[1]}") format("${format}");font-weight:100 900;font-display:swap}`;
}
