import type { CreditsData, CreditsPerson } from "@repo/schemas";
import type { CreditsSectionId, CreditsWidgetItemConfig } from "./credits-widget-config";

/** One name on the roll, with the text the design prints after it. */
export interface CreditsViewName {
  key: string;
  name: string;
  avatar?: string;
  /** "500 Bits", "×5", "42 viewers". Empty when values are off or there's none. */
  valueText: string;
}

export type CreditsViewKind = "title" | "names" | "stat" | "text" | "outro";

export interface CreditsViewSection {
  id: CreditsSectionId;
  kind: CreditsViewKind;
  /** The heading; for title and outro, the line itself. */
  label: string;
  names: CreditsViewName[];
  /** How many names were cut by the per-section limit. */
  overflow: number;
  /** "and 12 more", ready to print; empty when nothing was cut. */
  overflowText: string;
  /** Total people in the section, for "New followers · 12". Names sections only. */
  count: number | null;
  /** The one value a stat section shows: "87", "2h 14m". */
  stat: string;
  /** Free text under a text section. */
  text: string;
}

const numberFormat = new Intl.NumberFormat("en-US");

export function formatCreditsNumber(n: number): string {
  return numberFormat.format(n);
}

/** "2h 14m", "48m", "3h". Under a minute reads "1m" so the line is never "0m". */
export function formatCreditsDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h === 0) return `${Math.max(1, m)}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function plural(n: number, one: string, many: string): string {
  return `${formatCreditsNumber(n)} ${n === 1 ? one : many}`;
}

/** The text after a name in each people section. */
function valueText(id: CreditsSectionId, p: CreditsPerson): string {
  const v = p.value;
  if (v === undefined || v <= 0) return "";
  switch (id) {
    case "gifters":
      return plural(v, "sub", "subs");
    case "cheerers":
      return plural(v, "Bit", "Bits");
    case "raids":
      return plural(v, "viewer", "viewers");
    case "resubs":
      return plural(v, "month", "months");
    case "redemptions":
      return `×${formatCreditsNumber(v)}`;
    default:
      return "";
  }
}

const PEOPLE_BY_SECTION: Partial<Record<CreditsSectionId, keyof CreditsData>> = {
  followers: "followers",
  subs: "subs",
  resubs: "resubs",
  gifters: "gifters",
  cheerers: "cheerers",
  raids: "raids",
  redemptions: "redeemers",
};

/** Cuts a list to `max` (0 = all) and says how many were left out. */
export function applyNameLimit<T>(list: readonly T[], max: number): { kept: T[]; overflow: number } {
  if (max <= 0 || list.length <= max) return { kept: [...list], overflow: 0 };
  return { kept: list.slice(0, max), overflow: list.length - max };
}

export function overflowLine(moreText: string, overflow: number): string {
  if (overflow <= 0) return "";
  const line = moreText.includes("{n}")
    ? moreText.replace("{n}", formatCreditsNumber(overflow))
    : `${moreText} ${formatCreditsNumber(overflow)}`;
  return line.trim();
}

function hypeStat(data: CreditsData): string {
  const h = data.hype_train;
  if (!h || h.count <= 0) return "";
  if (h.count === 1) return `Level ${h.top_level}`;
  return `${plural(h.count, "train", "trains")} · top level ${h.top_level}`;
}

/**
 * The sections a roll shows, in the streamer's order, with everything empty
 * left out: a section with no names, a stat with no value, a blank note.
 * Designs draw from this and never look at the raw data.
 */
export function buildCreditsView(data: CreditsData, cfg: CreditsWidgetItemConfig): CreditsViewSection[] {
  const out: CreditsViewSection[] = [];
  const base = (id: CreditsSectionId, kind: CreditsViewKind, label: string): CreditsViewSection => ({
    id,
    kind,
    label,
    names: [],
    overflow: 0,
    overflowText: "",
    count: null,
    stat: "",
    text: "",
  });

  for (const section of cfg.sections) {
    if (!section.enabled) continue;
    const { id } = section;

    if (id === "title") {
      const line = cfg.titleText.trim();
      if (line) out.push(base(id, "title", line));
      continue;
    }
    if (id === "outro") {
      const line = cfg.outroText.trim();
      if (line) out.push(base(id, "outro", line));
      continue;
    }
    if (id === "thanks") {
      const body = cfg.thanksText.trim();
      if (!body) continue;
      out.push({ ...base(id, "text", section.label), text: body });
      continue;
    }
    if (id === "peak_viewers") {
      if (data.peak_viewers === null || data.peak_viewers <= 0) continue;
      out.push({ ...base(id, "stat", section.label), stat: formatCreditsNumber(data.peak_viewers) });
      continue;
    }
    if (id === "duration") {
      if (data.duration_seconds === null || data.duration_seconds <= 0) continue;
      out.push({ ...base(id, "stat", section.label), stat: formatCreditsDuration(data.duration_seconds) });
      continue;
    }
    if (id === "hype_train") {
      const stat = hypeStat(data);
      if (!stat) continue;
      out.push({ ...base(id, "stat", section.label), stat });
      continue;
    }

    const key = PEOPLE_BY_SECTION[id];
    if (!key) continue;
    const people = data[key] as CreditsPerson[];
    if (people.length === 0) continue;
    const { kept, overflow } = applyNameLimit(people, cfg.maxNamesPerSection);
    out.push({
      ...base(id, "names", section.label),
      names: kept.map((p, i) => ({
        key: p.user_id ?? `anon-${i}`,
        name: p.name,
        avatar: cfg.showAvatars ? p.profile_image_url : undefined,
        valueText: cfg.showValues ? valueText(id, p) : "",
      })),
      overflow,
      overflowText: overflowLine(cfg.moreText, overflow),
      count: cfg.showCounts ? people.length : null,
    });
  }

  return out;
}
