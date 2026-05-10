/**
 * Offline fallback when metadata fetch fails (subset of fonts.google.com).
 * The editor loads the full catalog via `getGoogleFontsCatalog()` in `src/lib/google-fonts-catalog.ts`.
 */
export const FALLBACK_GOOGLE_FONT_FAMILIES = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Raleway",
  "Nunito",
  "Merriweather",
  "Playfair Display",
  "Oswald",
  "Rubik",
  "Work Sans",
  "Noto Sans",
  "Source Sans 3",
  "Ubuntu",
  "Barlow",
  "Fira Sans",
  "Manrope",
  "DM Sans",
  "Space Grotesk",
  "Outfit",
  "Sora",
  "Lexend",
  "Bebas Neue",
  "Anton",
  "Permanent Marker",
  "JetBrains Mono",
] as const;

/** @deprecated Use `FALLBACK_GOOGLE_FONT_FAMILIES` or `getGoogleFontsCatalog()`. */
export const GOOGLE_FONT_FAMILIES = FALLBACK_GOOGLE_FONT_FAMILIES;

/**
 * Popular fonts shown in the picker before the user searches.
 * The full catalog loads in the background for debounced search.
 */
export const FEATURED_GOOGLE_FONT_FAMILIES = FALLBACK_GOOGLE_FONT_FAMILIES;

/** Any Google Font family string validated for storage and CSS. */
export type GoogleFontFamily = string;

const fontNameUnsafe = /[<>]/;

/**
 * Safe to persist and pass to Google Fonts CSS URLs.
 * Does not verify the name exists on Google (invalid names simply won’t load).
 */
export function isValidGoogleFontFamilyName(value: string): boolean {
  const t = value.trim();
  if (t.length < 1 || t.length > 200) return false;
  if (fontNameUnsafe.test(t)) return false;
  return /^[\p{L}\p{M}\p{N}\s'+\-.,&()]+$/u.test(t);
}

/** @deprecated Use `isValidGoogleFontFamilyName`. */
export function isGoogleFontFamily(value: string): value is GoogleFontFamily {
  return isValidGoogleFontFamilyName(value);
}

/** CSS2 API URL; loads weights 400–700 used by the text widget. */
export function googleFontStylesheetHref(family: string): string {
  const q = family.trim().replace(/\s+/g, "+");
  return `https://fonts.googleapis.com/css2?family=${q}:wght@400;500;600;700&display=swap`;
}

/** Batch URL for a small set of families only (avoid huge URLs). */
export function googleFontsBatchStylesheetHref(
  families: readonly string[]
): string {
  if (families.length === 0) {
    return `https://fonts.googleapis.com/css2?display=swap`;
  }
  const encode = (f: string) => f.trim().replace(/\s+/g, "+");
  const segments = families.map(
    (f) => `family=${encode(f)}:wght@400;500;600;700`
  );
  return `https://fonts.googleapis.com/css2?${segments.join("&")}&display=swap`;
}

export const DEFAULT_GOOGLE_FONT_FAMILY: GoogleFontFamily = "Inter";
