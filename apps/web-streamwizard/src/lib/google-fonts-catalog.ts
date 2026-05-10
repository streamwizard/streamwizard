import { FALLBACK_GOOGLE_FONT_FAMILIES } from "@/constants/google-fonts";

let cache: string[] | null = null;

export function parseGoogleFontsMetadataText(raw: string): string[] {
  const trimmed = raw.replace(/^\)\]\}'\s*/, "");
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return [...FALLBACK_GOOGLE_FONT_FAMILIES];
  }

  if (!data || typeof data !== "object") {
    return [...FALLBACK_GOOGLE_FONT_FAMILIES];
  }

  const obj = data as Record<string, unknown>;
  const list = obj.familyMetadataList ?? obj.families;
  if (!Array.isArray(list)) {
    return [...FALLBACK_GOOGLE_FONT_FAMILIES];
  }

  const names = list
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const fam = (entry as { family?: unknown }).family;
      return typeof fam === "string" && fam.trim().length > 0 ? fam.trim() : null;
    })
    .filter((f): f is string => Boolean(f));

  if (names.length === 0) {
    return [...FALLBACK_GOOGLE_FONT_FAMILIES];
  }

  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

/**
 * Full catalog for the overlay editor (client). Uses `/api/fonts/google-catalog`
 * so we avoid browser CORS on fonts.google.com.
 */
export async function getGoogleFontsCatalog(): Promise<string[]> {
  if (cache && cache.length > 0) return cache;

  try {
    const res = await fetch("/api/fonts/google-catalog");
    if (!res.ok) {
      cache = [...FALLBACK_GOOGLE_FONT_FAMILIES];
      return cache;
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data) || !data.every((x) => typeof x === "string")) {
      cache = [...FALLBACK_GOOGLE_FONT_FAMILIES];
      return cache;
    }
    cache = data as string[];
    return cache;
  } catch {
    cache = [...FALLBACK_GOOGLE_FONT_FAMILIES];
    return cache;
  }
}

export function clearGoogleFontsCatalogCache(): void {
  cache = null;
}
