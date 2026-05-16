import { z } from "zod";

// ─── stream.online ───────────────────────────────────────────────────────────

export const StreamOnlineEventSchema = z.object({
  id: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  type: z.enum(["live", "playlist", "watch_party", "premiere", "rerun"]),
  started_at: z.string(),
});

export type StreamOnlineEvent = z.infer<typeof StreamOnlineEventSchema>;

// ─── stream.offline ──────────────────────────────────────────────────────────

export const StreamOfflineEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
});

export type StreamOfflineEvent = z.infer<typeof StreamOfflineEventSchema>;