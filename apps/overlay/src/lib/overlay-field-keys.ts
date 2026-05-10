/** Six clip overlay typography keys (spec). */
export const CLIP_DISPLAY_FIELD_KEYS = [
  "title",
  "creator",
  "game",
  "date",
  "viewCount",
  "duration",
] as const;

export type ClipDisplayFieldKey = (typeof CLIP_DISPLAY_FIELD_KEYS)[number];
