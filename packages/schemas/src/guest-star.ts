import { z } from "zod";

// ─── channel.guest_star_session.begin (BETA) ─────────────────────────────────

export const ChannelGuestStarSessionBeginEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_name: z.string(),
  broadcaster_user_login: z.string(),
  moderator_user_id: z.string(),
  moderator_user_name: z.string(),
  moderator_user_login: z.string(),
  session_id: z.string(),
  started_at: z.string(),
});

export type ChannelGuestStarSessionBeginEvent = z.infer<
  typeof ChannelGuestStarSessionBeginEventSchema
>;

// ─── channel.guest_star_session.end (BETA) ───────────────────────────────────

export const ChannelGuestStarSessionEndEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_name: z.string(),
  broadcaster_user_login: z.string(),
  moderator_user_id: z.string(),
  moderator_user_name: z.string(),
  moderator_user_login: z.string(),
  session_id: z.string(),
  started_at: z.string(),
  ended_at: z.string(),
});

export type ChannelGuestStarSessionEndEvent = z.infer<typeof ChannelGuestStarSessionEndEventSchema>;

// ─── channel.guest_star_guest.update (BETA) ──────────────────────────────────

export const ChannelGuestStarGuestUpdateEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_name: z.string(),
  broadcaster_user_login: z.string(),
  session_id: z.string(),
  moderator_user_id: z.string(),
  moderator_user_name: z.string(),
  moderator_user_login: z.string(),
  guest_user_id: z.string(),
  guest_user_name: z.string(),
  guest_user_login: z.string(),
  slot_id: z.string(),
  state: z.enum(["invited", "accepted", "ready", "backstage", "live", "removed"]),
  host_video_enabled: z.boolean(),
  host_audio_enabled: z.boolean(),
  host_volume: z.number().int(),
});

export type ChannelGuestStarGuestUpdateEvent = z.infer<typeof ChannelGuestStarGuestUpdateEventSchema>;

// ─── channel.guest_star_settings.update (BETA) ───────────────────────────────

export const ChannelGuestStarSettingsUpdateEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_name: z.string(),
  broadcaster_user_login: z.string(),
  is_moderator_send_live_enabled: z.boolean(),
  slot_count: z.number().int(),
  is_browser_source_audio_enabled: z.boolean(),
  group_layout: z.enum(["tiled", "screenshare"]),
});

export type ChannelGuestStarSettingsUpdateEvent = z.infer<
  typeof ChannelGuestStarSettingsUpdateEventSchema
>;