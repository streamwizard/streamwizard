import type { Database } from "@repo/supabase";

/** The clip columns the overlay editor's clips preview reads. */
export type PreviewClip = Pick<
  Database["public"]["Tables"]["clips"]["Row"],
  | "id"
  | "twitch_clip_id"
  | "title"
  | "broadcaster_id"
  | "broadcaster_name"
  | "creator_name"
  | "game_name"
  | "view_count"
  | "duration"
  | "created_at_twitch"
  | "thumbnail_url"
>;
