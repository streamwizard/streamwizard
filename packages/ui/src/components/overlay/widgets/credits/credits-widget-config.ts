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

export const CREDITS_WIDGET_PRESETS = ["classic", "cards", "ticker", "arcade", "minimal", "cinematic"] as const;
export type CreditsWidgetPreset = (typeof CREDITS_WIDGET_PRESETS)[number];

export const CREDITS_WIDGET_PRESET_LABELS: Record<CreditsWidgetPreset, string> = {
  classic: "Classic",
  cards: "Cards",
  ticker: "Ticker",
  arcade: "Arcade",
  minimal: "Minimal",
  cinematic: "Cinematic",
};

/** The box a preset is drawn for. Picking a preset resizes the widget to it. */
export const CREDITS_WIDGET_PRESET_SIZES: Record<CreditsWidgetPreset, { w: number; h: number }> = {
  classic: { w: 640, h: 900 },
  cards: { w: 720, h: 480 },
  ticker: { w: 1280, h: 64 },
  arcade: { w: 640, h: 800 },
  minimal: { w: 520, h: 800 },
  cinematic: { w: 1280, h: 720 },
};

/** Arcade reads as arcade because of its font; picking it switches to this one. */
export const CREDITS_WIDGET_ARCADE_FONT = "Press Start 2P";

/** Designs that scroll the whole roll past; the others step one section at a time. */
export const CREDITS_SCROLL_PRESETS: readonly CreditsWidgetPreset[] = ["classic", "arcade", "minimal", "ticker"];

export function isCreditsScrollPreset(preset: CreditsWidgetPreset): boolean {
  return CREDITS_SCROLL_PRESETS.includes(preset);
}

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
  outro: "Outro",
};

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
  /** 0 = everyone. */
  maxNamesPerSection: { min: 0, max: 200 },
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
