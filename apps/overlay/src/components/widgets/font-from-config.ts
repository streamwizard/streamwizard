import type { Json } from "@/types/supabase";

/** Reads `fontFamily` from widget JSON config for Google Fonts loading. */
export function readGoogleFontFamilyFromConfig(config: Json): string | null {
  const o =
    typeof config === "object" && config !== null && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : {};
  const ff = o.fontFamily;
  return typeof ff === "string" && ff.trim() ? ff.trim() : null;
}
