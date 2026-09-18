import { DEFAULT_THEME_ID, type BannerElement, type BuiltMessage } from "./schema";

// Banner backgrounds. The files sit in ../assets/themes: the bot attaches them
// from disk, web-admin bundles them for the preview. Placeholder artwork made
// by scripts/generate-themes.py; swap a file (same name) to replace one, or
// add a row here plus its file for a new theme.

export interface ThemeDefinition {
  id: string;
  name: string;
  category: string;
  /** File name inside assets/themes. */
  file: string;
  /** Animated themes are gifs and get a GIF badge. */
  animated: boolean;
}

export const THEME_CATEGORIES = [
  "Classic",
  "Anime/Manga",
  "Gaming",
  "Lo-Fi/Chill Vibes",
  "Glitch",
  "Space",
  "Minimal",
] as const;

export type ThemeCategory = (typeof THEME_CATEGORIES)[number];

const theme = (id: string, name: string, category: ThemeCategory, animated = false): ThemeDefinition => ({
  id,
  name,
  category,
  file: `${id}.${animated ? "gif" : "png"}`,
  animated,
});

export const THEMES: ThemeDefinition[] = [
  theme(DEFAULT_THEME_ID, "Classic", "Classic"),
  theme("classic-blurple", "Blurple", "Classic"),
  theme("classic-midnight", "Midnight", "Classic"),
  theme("anime-sakura", "Sakura", "Anime/Manga"),
  theme("anime-sunset", "Sunset", "Anime/Manga"),
  theme("anime-speedlines", "Speed lines", "Anime/Manga", true),
  theme("gaming-arcade", "Arcade", "Gaming"),
  theme("gaming-pixels", "Pixels", "Gaming"),
  theme("gaming-neon-grid", "Neon grid", "Gaming", true),
  theme("lofi-dusk", "Dusk", "Lo-Fi/Chill Vibes"),
  theme("lofi-paper", "Paper", "Lo-Fi/Chill Vibes"),
  theme("lofi-rain", "Rain", "Lo-Fi/Chill Vibes", true),
  theme("glitch-rgb", "RGB split", "Glitch"),
  theme("glitch-scanlines", "Scanlines", "Glitch"),
  theme("glitch-signal", "Lost signal", "Glitch", true),
  theme("space-nebula", "Nebula", "Space"),
  theme("space-stars", "Starfield", "Space", true),
  theme("minimal-slate", "Slate", "Minimal"),
  theme("minimal-cream", "Cream", "Minimal"),
];

const BY_ID = new Map(THEMES.map((t) => [t.id, t]));

export const isKnownTheme = (id: string): boolean => BY_ID.has(id);

/** Falls back to the default theme, so a removed theme never leaves a banner without an image. */
export function getTheme(id: string): ThemeDefinition {
  const found = BY_ID.get(id) ?? BY_ID.get(DEFAULT_THEME_ID);
  if (!found) throw new Error("The default theme is missing from THEMES");
  return found;
}

export type BannerSource = { kind: "upload"; url: string } | { kind: "theme"; theme: ThemeDefinition };

/** Where a banner's image comes from: its own upload, else the message theme. */
export function resolveBannerSource(banner: BannerElement, message: Pick<BuiltMessage, "themeId">): BannerSource {
  if (banner.image) return { kind: "upload", url: banner.image.url };
  return { kind: "theme", theme: getTheme(message.themeId) };
}

export function themesByCategory(themes: readonly ThemeDefinition[] = THEMES): [string, ThemeDefinition[]][] {
  const groups = new Map<string, ThemeDefinition[]>();
  for (const item of themes) groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
  return [...groups];
}
