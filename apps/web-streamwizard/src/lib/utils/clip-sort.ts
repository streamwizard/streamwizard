export const CLIP_SORT_KEYS = ["name", "creator", "game", "views", "date", "duration"] as const;

export type ClipSortKey = (typeof CLIP_SORT_KEYS)[number];

export const CLIP_SORT_COLUMNS: Record<ClipSortKey, string> = {
  name: "title",
  creator: "creator_name",
  game: "game_name",
  views: "view_count",
  date: "created_at_twitch",
  duration: "duration",
};

/** Default ascending direction when a column is first selected. */
export const CLIP_SORT_DEFAULT_ASC: Record<ClipSortKey, boolean> = {
  name: true,
  creator: true,
  game: true,
  views: false,
  date: false,
  duration: false,
};

export function parseClipSortKey(sort?: string | null): ClipSortKey {
  if (sort && CLIP_SORT_KEYS.includes(sort as ClipSortKey)) {
    return sort as ClipSortKey;
  }
  return "date";
}

export function parseClipSortAscending(asc?: string | null): boolean {
  return asc === "true";
}
