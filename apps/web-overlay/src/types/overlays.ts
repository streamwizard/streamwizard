import type { Database } from "@repo/supabase";
import type { ClipsWidgetConfig as ParsedClipsWidgetConfig } from "@/lib/clips-widget-config";

/** Supabase overlay scene / item rows (do not export from `"use server"` files — Turbopack action bridge). */
export type OverlaySceneRow = Database["public"]["Tables"]["overlay_scenes"]["Row"];
export type OverlayItemRow = Database["public"]["Tables"]["overlay_items"]["Row"];

/** Matches persisted clips widget `timeWindow` (editor / overlay). */
export type TimeWindowPreset =
  | "last7d"
  | "last30d"
  | "last90d"
  | "last365d"
  | "all"
  | "custom";

export type ClipsWidgetConfig = ParsedClipsWidgetConfig;
