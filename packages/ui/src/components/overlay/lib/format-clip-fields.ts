import type { DisplayFieldKey } from "../types";

export interface ClipFieldData {
  title: string;
  creatorName: string;
  gameName: string | null;
  createdAtTwitch: string;
  viewCount: number | null;
  durationSec: number | null;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatClipDuration(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(r)}`;
  return `${m}:${pad2(r)}`;
}

export function formatClipDate(iso: string): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(d));
}

export function formatClipViewCount(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, {
    notation: n >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n);
}

export function formatClipField(clip: ClipFieldData, key: DisplayFieldKey): string {
  switch (key) {
    case "title":
      return clip.title;
    case "creator":
      return clip.creatorName;
    case "game":
      return clip.gameName ?? "—";
    case "date":
      return formatClipDate(clip.createdAtTwitch);
    case "viewCount":
      return formatClipViewCount(clip.viewCount);
    case "duration":
      return formatClipDuration(clip.durationSec);
    default:
      return "";
  }
}
