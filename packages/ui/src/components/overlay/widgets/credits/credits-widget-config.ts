import {
  DEFAULT_GOOGLE_FONT_FAMILY,
  isValidGoogleFontFamilyName,
  type GoogleFontFamily,
} from "../../types";

/**
 * End-of-stream credits. Rolls the names from the stream that just ended (or
 * is still running): followers, subs, gifts, Bits, raids and more. The numbers
 * come from StreamWizard's own event log through /api/twitch/credits; the
 * widget only plays them back. It starts on its own when the browser source
 * becomes visible, so an "Ending" scene in OBS is all the setup it needs.
 */
export const CREDITS_WIDGET_TYPE = "credits_widget" as const;
export type CreditsWidgetType = typeof CREDITS_WIDGET_TYPE;

// ─── Designs ────────────────────────────────────────────────────────────────

export const CREDITS_WIDGET_PRESETS = ["classic", "cards", "ticker", "arcade", "minimal", "cinematic", "hybrid"] as const;
export type CreditsWidgetPreset = (typeof CREDITS_WIDGET_PRESETS)[number];

export const CREDITS_WIDGET_PRESET_LABELS: Record<CreditsWidgetPreset, string> = {
  classic: "Classic",
  cards: "Cards",
  ticker: "Ticker",
  arcade: "Arcade",
  minimal: "Minimal",
  cinematic: "Cinematic",
  hybrid: "Hybrid",
};

/** The box a preset is drawn for. Picking a preset resizes the widget to it. */
export const CREDITS_WIDGET_PRESET_SIZES: Record<CreditsWidgetPreset, { w: number; h: number }> = {
  classic: { w: 640, h: 900 },
  cards: { w: 720, h: 480 },
  ticker: { w: 1280, h: 64 },
  arcade: { w: 640, h: 800 },
  minimal: { w: 520, h: 800 },
  cinematic: { w: 1280, h: 720 },
  hybrid: { w: 720, h: 900 },
};

/** Arcade reads as arcade because of its font; picking it switches to this one. */
export const CREDITS_WIDGET_ARCADE_FONT = "Press Start 2P";

/**
 * Designs that scroll the whole roll past; the others step one section at a
 * time. Hybrid does both: hero cards first, then the roll, so it counts as
 * scrolling for the speed setting.
 */
export const CREDITS_SCROLL_PRESETS: readonly CreditsWidgetPreset[] = ["classic", "arcade", "minimal", "ticker", "hybrid"];

export function isCreditsScrollPreset(preset: CreditsWidgetPreset): boolean {
  return CREDITS_SCROLL_PRESETS.includes(preset);
}

// ─── Hero cards (Hybrid) ────────────────────────────────────────────────────

/**
 * Sections whose top people can open the Hybrid roll as hero cards. Only
 * sections with a number behind each name qualify: there's no "top follower".
 */
export const CREDITS_HERO_CATEGORIES = ["gifters", "cheerers", "raids", "resubs", "redemptions"] as const;
export type CreditsHeroCategory = (typeof CREDITS_HERO_CATEGORIES)[number];

export function isCreditsHeroCategory(value: unknown): value is CreditsHeroCategory {
  return (CREDITS_HERO_CATEGORIES as readonly unknown[]).includes(value);
}

/** The role label over a hero card, for one name and for several. */
export const CREDITS_HERO_LABELS: Record<CreditsHeroCategory, { one: string; many: string }> = {
  gifters: { one: "Top gifter", many: "Top gifters" },
  cheerers: { one: "Top cheerer", many: "Top cheerers" },
  raids: { one: "Biggest raid", many: "Biggest raids" },
  resubs: { one: "Longest sub", many: "Longest subs" },
  redemptions: { one: "Top redeemer", many: "Top redeemers" },
};

/** What the threshold counts, per category, for the settings. */
export const CREDITS_HERO_THRESHOLD_UNITS: Record<CreditsHeroCategory, string> = {
  gifters: "subs gifted",
  cheerers: "Bits",
  raids: "viewers",
  resubs: "months",
  redemptions: "redemptions",
};

export type CreditsHeroThresholds = Record<CreditsHeroCategory, number>;

/** A person counts as a hero from this much up. 0 turns the threshold off. */
export const CREDITS_DEFAULT_HERO_THRESHOLDS: CreditsHeroThresholds = {
  gifters: 5,
  cheerers: 500,
  raids: 10,
  resubs: 12,
  redemptions: 5,
};

// ─── Sections ───────────────────────────────────────────────────────────────

/**
 * Everything the roll can show, in its default order. The streamer turns
 * sections off, reorders them and renames the labels in the settings.
 */
export const CREDITS_SECTION_IDS = [
  "title",
  "followers",
  "subs",
  "resubs",
  "gifters",
  "cheerers",
  "raids",
  "redemptions",
  "hype_train",
  "peak_viewers",
  "duration",
  "thanks",
  "socials",
  "outro",
] as const;
export type CreditsSectionId = (typeof CREDITS_SECTION_IDS)[number];

export function isCreditsSectionId(value: unknown): value is CreditsSectionId {
  return (CREDITS_SECTION_IDS as readonly unknown[]).includes(value);
}

export interface CreditsSection {
  id: CreditsSectionId;
  enabled: boolean;
  /** The heading over the section. Title and outro take their text from the config instead. */
  label: string;
}

export const CREDITS_SECTION_DEFAULT_LABELS: Record<CreditsSectionId, string> = {
  title: "",
  followers: "New followers",
  subs: "New subs",
  resubs: "Resubs",
  gifters: "Gifted subs",
  cheerers: "Bits",
  raids: "Raids",
  redemptions: "Channel points",
  hype_train: "Hype trains",
  peak_viewers: "Peak viewers",
  duration: "Stream length",
  thanks: "Thank you",
  socials: "Find me on",
  outro: "",
};

/** What the settings call each section, for the list where they're turned on and off. */
export const CREDITS_SECTION_NAMES: Record<CreditsSectionId, string> = {
  title: "Title",
  followers: "Followers",
  subs: "Subs",
  resubs: "Resubs",
  gifters: "Gifters",
  cheerers: "Cheerers",
  raids: "Raids",
  redemptions: "Channel points",
  hype_train: "Hype trains",
  peak_viewers: "Peak viewers",
  duration: "Stream length",
  thanks: "Thank-you note",
  socials: "Socials",
  outro: "Outro",
};

// ─── Socials ────────────────────────────────────────────────────────────────

/** The platforms a streamer can list, with a logo each. */
export const CREDITS_SOCIAL_PLATFORMS = ["instagram", "tiktok", "youtube", "twitch", "x", "kick", "discord", "bluesky"] as const;
export type CreditsSocialPlatform = (typeof CREDITS_SOCIAL_PLATFORMS)[number];

export function isCreditsSocialPlatform(value: unknown): value is CreditsSocialPlatform {
  return (CREDITS_SOCIAL_PLATFORMS as readonly unknown[]).includes(value);
}

export const CREDITS_SOCIAL_PLATFORM_LABELS: Record<CreditsSocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitch: "Twitch",
  x: "X",
  kick: "Kick",
  discord: "Discord",
  bluesky: "Bluesky",
};

/**
 * Each brand's own colour. Null for the black-on-white brands (TikTok, X):
 * their logo takes the text colour instead, so it stays visible over a dark
 * ending scene.
 */
export const CREDITS_SOCIAL_BRAND_COLORS: Record<CreditsSocialPlatform, string | null> = {
  instagram: "#E4405F",
  tiktok: null,
  youtube: "#FF0000",
  twitch: "#9146FF",
  x: null,
  kick: "#53FC18",
  discord: "#5865F2",
  bluesky: "#0285FF",
};

/** What a handle looks like on each platform, for the settings' placeholder. */
export const CREDITS_SOCIAL_PLACEHOLDERS: Record<CreditsSocialPlatform, string> = {
  instagram: "@yourname",
  tiktok: "@yourname",
  youtube: "@yourchannel",
  twitch: "yourchannel",
  x: "@yourname",
  kick: "yourchannel",
  discord: "discord.gg/yourserver",
  bluesky: "@yourname.bsky.social",
};

export interface CreditsSocial {
  platform: CreditsSocialPlatform;
  /** Shown as typed: with or without the @, a channel name, an invite link. */
  handle: string;
}

export const CREDITS_SOCIALS_LAYOUTS = ["list", "row"] as const;
export type CreditsSocialsLayout = (typeof CREDITS_SOCIALS_LAYOUTS)[number];

/** Sections whose heading the streamer can rename. Title and outro are their own text. */
export function creditsSectionHasLabel(id: CreditsSectionId): boolean {
  return id !== "title" && id !== "outro";
}

export const CREDITS_DEFAULT_SECTIONS: readonly CreditsSection[] = CREDITS_SECTION_IDS.map((id) => ({
  id,
  enabled: true,
  label: CREDITS_SECTION_DEFAULT_LABELS[id],
}));

// ─── Config ─────────────────────────────────────────────────────────────────

export const CREDITS_WIDGET_LIMITS = {
  sectionLabel: 40,
  titleText: 80,
  outroText: 80,
  thanksText: 600,
  moreText: 40,
  fontSize: { min: 12, max: 72 },
  /** Stepped designs: how long each section stays up. */
  secondsPerSection: { min: 2, max: 30 },
  /** Scrolling designs: px per second at the widget's own size. */
  scrollSpeed: { min: 20, max: 240 },
  startDelaySeconds: { min: 0, max: 15 },
  /** Loop: the pause with nothing on screen before the next pass. */
  loopDelaySeconds: { min: 0, max: 60 },
  /** 0 = everyone. */
  maxNamesPerSection: { min: 0, max: 200 },
  /** Hybrid: how many heroes per category, names per card, and the card timing. */
  heroTopCount: { min: 1, max: 10 },
  heroGroupSize: { min: 1, max: 5 },
  heroHoldSeconds: { min: 1, max: 15 },
  heroFadeMs: { min: 100, max: 2000 },
  heroThreshold: { min: 0, max: 1_000_000 },
  socialHandle: 60,
  /** One entry per platform at most. */
  socials: CREDITS_SOCIAL_PLATFORMS.length,
} as const;

export interface CreditsWidgetItemConfig {
  preset: CreditsWidgetPreset;
  sections: CreditsSection[];
  titleText: string;
  outroText: string;
  /** Free text under the thank-you heading. Blank hides the section. */
  thanksText: string;
  /** "New followers · 12" */
  showCounts: boolean;
  /** "sandwichlord · 500 Bits" */
  showValues: boolean;
  showAvatars: boolean;
  maxNamesPerSection: number;
  /** Shown after a cut list; {n} is how many were left out. */
  moreText: string;
  secondsPerSection: number;
  scrollSpeed: number;
  startDelaySeconds: number;
  /** Start again when the roll ends; off keeps the last section up. */
  loop: boolean;
  /** Loop: how long to wait after a pass before the next one starts. */
  loopDelaySeconds: number;
  /** Hybrid: sections whose top people open the roll as hero cards, in section order. */
  heroCategories: CreditsHeroCategory[];
  /** Hybrid: the least someone needs in a category to be a hero. 0 = no floor. */
  heroThresholds: CreditsHeroThresholds;
  /** Hybrid: at most this many heroes per category. */
  heroTopCount: number;
  /** Hybrid: names on one card. */
  heroGroupSize: number;
  /** Hybrid: how long a card stays up between its fades. */
  heroHoldSeconds: number;
  /** Hybrid: fade in and fade out length. */
  heroFadeMs: number;
  /** The streamer's platforms and handles for the Socials section. */
  socials: CreditsSocial[];
  /** Logos in each brand's colour; off draws them in the accent colour. */
  socialsBrandColors: boolean;
  /** One under the other, or side by side. */
  socialsLayout: CreditsSocialsLayout;
  fontFamily: GoogleFontFamily;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  textColor: string;
  /** Section headings and small accents. */
  accentColor: string;
  backgroundColor: string;
  /** 0 keeps the widget transparent over the scene. */
  backgroundOpacity: number;
  textShadow: boolean;
  /**
   * The font from before Arcade swapped in its own, put back when the
   * streamer picks another design. Empty when there's nothing to put back,
   * including once they choose a font themselves while on Arcade.
   */
  arcadeRestoreFont: string;
}

export function createDefaultCreditsWidgetConfig(): CreditsWidgetItemConfig {
  return {
    preset: "classic",
    sections: CREDITS_DEFAULT_SECTIONS.map((s) => ({ ...s })),
    titleText: "Thanks for watching",
    outroText: "See you next stream",
    thanksText: "",
    showCounts: true,
    showValues: true,
    showAvatars: false,
    maxNamesPerSection: 30,
    moreText: "and {n} more",
    secondsPerSection: 6,
    scrollSpeed: 60,
    startDelaySeconds: 1,
    loop: false,
    loopDelaySeconds: 3,
    heroCategories: ["gifters", "cheerers", "raids"],
    heroThresholds: { ...CREDITS_DEFAULT_HERO_THRESHOLDS },
    heroTopCount: 3,
    heroGroupSize: 1,
    heroHoldSeconds: 3,
    heroFadeMs: 700,
    socials: [],
    socialsBrandColors: true,
    socialsLayout: "list",
    fontFamily: DEFAULT_GOOGLE_FONT_FAMILY,
    fontSize: 28,
    fontWeight: 600,
    textColor: "#ffffff",
    accentColor: "#9e7aff",
    backgroundColor: "#0b0b12",
    backgroundOpacity: 0,
    textShadow: true,
    arcadeRestoreFont: "",
  };
}

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function color(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function text(value: unknown, max: number, fallback: string): string {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}

function clampInt(value: unknown, { min, max }: { min: number; max: number }, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Repairs a stored section list: known ids in the order they were saved,
 * duplicates and unknowns dropped, and any section added since appended with
 * its default. An old row keeps its order and picks up new sections on its
 * own.
 */
export function normalizeCreditsSections(raw: unknown): CreditsSection[] {
  const out: CreditsSection[] = [];
  const seen = new Set<CreditsSectionId>();
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const e = (entry && typeof entry === "object" ? entry : {}) as Partial<Record<keyof CreditsSection, unknown>>;
      if (!isCreditsSectionId(e.id) || seen.has(e.id)) continue;
      seen.add(e.id);
      out.push({
        id: e.id,
        enabled: bool(e.enabled, true),
        label: creditsSectionHasLabel(e.id)
          ? text(e.label, CREDITS_WIDGET_LIMITS.sectionLabel, CREDITS_SECTION_DEFAULT_LABELS[e.id])
          : "",
      });
    }
  }
  for (const section of CREDITS_DEFAULT_SECTIONS) {
    if (!seen.has(section.id)) out.push({ ...section });
  }
  return out;
}

function normalizeHeroCategories(raw: unknown, fallback: CreditsHeroCategory[]): CreditsHeroCategory[] {
  if (!Array.isArray(raw)) return [...fallback];
  const out: CreditsHeroCategory[] = [];
  for (const v of raw) if (isCreditsHeroCategory(v) && !out.includes(v)) out.push(v);
  return out;
}

function normalizeHeroThresholds(raw: unknown): CreditsHeroThresholds {
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<CreditsHeroCategory, unknown>>;
  const out = { ...CREDITS_DEFAULT_HERO_THRESHOLDS };
  for (const id of CREDITS_HERO_CATEGORIES) {
    out[id] = clampInt(c[id], CREDITS_WIDGET_LIMITS.heroThreshold, out[id]);
  }
  return out;
}

/** Valid platforms with a non-blank handle, one per platform, in stored order. */
export function normalizeCreditsSocials(raw: unknown): CreditsSocial[] {
  if (!Array.isArray(raw)) return [];
  const out: CreditsSocial[] = [];
  const seen = new Set<CreditsSocialPlatform>();
  for (const entry of raw) {
    const e = (entry && typeof entry === "object" ? entry : {}) as Partial<Record<keyof CreditsSocial, unknown>>;
    if (!isCreditsSocialPlatform(e.platform) || seen.has(e.platform)) continue;
    const handle = typeof e.handle === "string" ? e.handle.trim().slice(0, CREDITS_WIDGET_LIMITS.socialHandle) : "";
    seen.add(e.platform);
    out.push({ platform: e.platform, handle });
    if (out.length >= CREDITS_WIDGET_LIMITS.socials) break;
  }
  return out;
}

/** Fills gaps and clamps a stored config, so a partial or old row still renders. */
export function normalizeCreditsWidgetConfig(raw: unknown): CreditsWidgetItemConfig {
  const d = createDefaultCreditsWidgetConfig();
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof CreditsWidgetItemConfig, unknown>>;
  return {
    preset: oneOf(c.preset, CREDITS_WIDGET_PRESETS, d.preset),
    sections: normalizeCreditsSections(c.sections),
    titleText: text(c.titleText, CREDITS_WIDGET_LIMITS.titleText, d.titleText),
    outroText: text(c.outroText, CREDITS_WIDGET_LIMITS.outroText, d.outroText),
    thanksText: text(c.thanksText, CREDITS_WIDGET_LIMITS.thanksText, d.thanksText),
    showCounts: bool(c.showCounts, d.showCounts),
    showValues: bool(c.showValues, d.showValues),
    showAvatars: bool(c.showAvatars, d.showAvatars),
    maxNamesPerSection: clampInt(c.maxNamesPerSection, CREDITS_WIDGET_LIMITS.maxNamesPerSection, d.maxNamesPerSection),
    moreText: text(c.moreText, CREDITS_WIDGET_LIMITS.moreText, d.moreText),
    secondsPerSection: clampInt(c.secondsPerSection, CREDITS_WIDGET_LIMITS.secondsPerSection, d.secondsPerSection),
    scrollSpeed: clampInt(c.scrollSpeed, CREDITS_WIDGET_LIMITS.scrollSpeed, d.scrollSpeed),
    startDelaySeconds: clampInt(c.startDelaySeconds, CREDITS_WIDGET_LIMITS.startDelaySeconds, d.startDelaySeconds),
    loop: bool(c.loop, d.loop),
    loopDelaySeconds: clampInt(c.loopDelaySeconds, CREDITS_WIDGET_LIMITS.loopDelaySeconds, d.loopDelaySeconds),
    heroCategories: normalizeHeroCategories(c.heroCategories, d.heroCategories),
    heroThresholds: normalizeHeroThresholds(c.heroThresholds),
    heroTopCount: clampInt(c.heroTopCount, CREDITS_WIDGET_LIMITS.heroTopCount, d.heroTopCount),
    heroGroupSize: clampInt(c.heroGroupSize, CREDITS_WIDGET_LIMITS.heroGroupSize, d.heroGroupSize),
    heroHoldSeconds: clampInt(c.heroHoldSeconds, CREDITS_WIDGET_LIMITS.heroHoldSeconds, d.heroHoldSeconds),
    heroFadeMs: clampInt(c.heroFadeMs, CREDITS_WIDGET_LIMITS.heroFadeMs, d.heroFadeMs),
    socials: normalizeCreditsSocials(c.socials),
    socialsBrandColors: bool(c.socialsBrandColors, d.socialsBrandColors),
    socialsLayout: oneOf(c.socialsLayout, CREDITS_SOCIALS_LAYOUTS, d.socialsLayout),
    fontFamily:
      typeof c.fontFamily === "string" && isValidGoogleFontFamilyName(c.fontFamily)
        ? c.fontFamily.trim()
        : d.fontFamily,
    fontSize: clampInt(c.fontSize, CREDITS_WIDGET_LIMITS.fontSize, d.fontSize),
    fontWeight: ([400, 500, 600, 700] as const).includes(c.fontWeight as 400)
      ? (c.fontWeight as CreditsWidgetItemConfig["fontWeight"])
      : d.fontWeight,
    textColor: color(c.textColor, d.textColor),
    accentColor: color(c.accentColor, d.accentColor),
    backgroundColor: color(c.backgroundColor, d.backgroundColor),
    backgroundOpacity:
      typeof c.backgroundOpacity === "number" && Number.isFinite(c.backgroundOpacity)
        ? Math.min(1, Math.max(0, c.backgroundOpacity))
        : d.backgroundOpacity,
    textShadow: bool(c.textShadow, d.textShadow),
    arcadeRestoreFont:
      typeof c.arcadeRestoreFont === "string" && isValidGoogleFontFamilyName(c.arcadeRestoreFont)
        ? c.arcadeRestoreFont.trim()
        : d.arcadeRestoreFont,
  };
}

/**
 * The config change for picking `next`. Arcade brings its pixel font and
 * remembers what was there; leaving Arcade puts it back, unless the streamer
 * picked a font themselves in the meantime.
 */
export function creditsPresetChange(
  cfg: CreditsWidgetItemConfig,
  next: CreditsWidgetPreset,
): Partial<CreditsWidgetItemConfig> {
  if (next === cfg.preset) return {};
  if (next === "arcade") {
    return { preset: next, fontFamily: CREDITS_WIDGET_ARCADE_FONT, arcadeRestoreFont: cfg.fontFamily };
  }
  if (cfg.preset !== "arcade") return { preset: next };
  return {
    preset: next,
    ...(cfg.arcadeRestoreFont ? { fontFamily: cfg.arcadeRestoreFont } : {}),
    arcadeRestoreFont: "",
  };
}
