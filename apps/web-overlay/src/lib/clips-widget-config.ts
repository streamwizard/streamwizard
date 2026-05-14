import type { Json } from "@repo/supabase";
import { z } from "zod";

const TIME_WINDOWS = [
  "last7d",
  "last30d",
  "last90d",
  "last365d",
  "all",
  "custom",
] as const;

const SORT_MODES = [
  "newest",
  "oldest",
  "most_viewed",
  "least_viewed",
  "random",
] as const;

/**
 * Persisted clips_widget JSON fields that affect which clips load (merged editor shape).
 * Extra keys on the JSON object are ignored when parsing.
 */
export const clipsWidgetConfigSchema = z.object({
  sourceMode: z.enum(["all", "folders", "game", "custom"]).optional(),
  folderIds: z.array(z.number().int()).max(500).default([]),
  gameIds: z.array(z.string().min(1)).max(200).default([]),
  creatorIds: z.array(z.string().min(1)).max(200).default([]),
  timeWindow: z.enum(TIME_WINDOWS).default("all"),
  customDateRange: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .optional(),
  sort: z.enum(SORT_MODES).default("newest"),
  maxClips: z.coerce.number().int().min(1).max(100).default(20),
  minViewCount: z.number().min(0).default(0),
  isFeaturedOnly: z.boolean().default(false),
});

export type ClipsWidgetConfig = z.infer<typeof clipsWidgetConfigSchema>;

const DEFAULT_QUERY_CONFIG: ClipsWidgetConfig =
  clipsWidgetConfigSchema.parse({});

export function parseClipsWidgetConfig(json: Json): ClipsWidgetConfig {
  const raw =
    typeof json === "object" && json !== null && !Array.isArray(json)
      ? json
      : {};

  const parsed = clipsWidgetConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return DEFAULT_QUERY_CONFIG;
  }
  return parsed.data;
}
