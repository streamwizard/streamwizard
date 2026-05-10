import type { ClipsWidgetConfig as ParsedClipsWidgetConfig } from "@/lib/clips-widget-config";

/** Matches persisted clips widget `timeWindow` (editor / overlay). */
export type TimeWindowPreset =
  | "last7d"
  | "last30d"
  | "last90d"
  | "last365d"
  | "all"
  | "custom";

export type ClipsWidgetConfig = ParsedClipsWidgetConfig;
