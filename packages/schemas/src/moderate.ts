import { z } from "zod";

// ─── Shared moderation action sub-schemas ───────────────────────────────────

const ModFollowersSchema = z.object({
  follow_duration_minutes: z.number().int(),
});

const ModSlowSchema = z.object({
  wait_time_seconds: z.number().int(),
});

const ModVipSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
});

const ModBanSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  reason: z.string().nullable(),
});

const ModTimeoutSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  reason: z.string().nullable(),
  expires_at: z.string(),
});

const ModRaidSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  viewer_count: z.number().int(),
});

const ModDeleteSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  message_id: z.string(),
  message_body: z.string(),
});

const ModAutomodTermsSchema = z.object({
  action: z.enum(["add_permitted", "remove_permitted", "add_blocked", "remove_blocked"]),
  list: z.enum(["permitted", "blocked"]),
  terms: z.array(z.string()),
  from_automod: z.boolean(),
});

const ModUnbanRequestSchema = z.object({
  is_approved: z.boolean(),
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  moderator_message: z.string(),
});

const ModSharedChatBanSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  reason: z.string().nullable(),
});

const ModSharedChatTimeoutSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  reason: z.string().nullable(),
  expires_at: z.string(),
});

const ModSharedChatDeleteSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  message_id: z.string(),
  message_body: z.string(),
});

// ─── channel.moderate (v1) ──────────────────────────────────────────────────

export const ChannelModerateEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  source_broadcaster_user_id: z.string().nullable().optional(),
  source_broadcaster_user_login: z.string().nullable().optional(),
  source_broadcaster_user_name: z.string().nullable().optional(),
  moderator_user_id: z.string(),
  moderator_user_login: z.string(),
  moderator_user_name: z.string(),
  action: z.string(),
  followers: ModFollowersSchema.nullable(),
  slow: ModSlowSchema.nullable(),
  vip: ModVipSchema.nullable(),
  unvip: ModVipSchema.nullable(),
  mod: ModVipSchema.nullable(),
  unmod: ModVipSchema.nullable(),
  ban: ModBanSchema.nullable(),
  unban: ModVipSchema.nullable(),
  timeout: ModTimeoutSchema.nullable(),
  untimeout: ModVipSchema.nullable(),
  raid: ModRaidSchema.nullable(),
  unraid: ModVipSchema.nullable(),
  delete: ModDeleteSchema.nullable(),
  automod_terms: ModAutomodTermsSchema.nullable(),
  unban_request: ModUnbanRequestSchema.nullable(),
  shared_chat_ban: ModSharedChatBanSchema.nullable(),
  shared_chat_unban: ModVipSchema.nullable(),
  shared_chat_timeout: ModSharedChatTimeoutSchema.nullable(),
  shared_chat_untimeout: ModVipSchema.nullable(),
  shared_chat_delete: ModSharedChatDeleteSchema.nullable(),
});

export type ChannelModerateEvent = z.infer<typeof ChannelModerateEventSchema>;

// ─── channel.moderate (v2) — adds warn field ────────────────────────────────

const ModWarnSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  reason: z.string().nullable(),
  chat_rules_cited: z.array(z.string()).nullable(),
});

export const ChannelModerateV2EventSchema = ChannelModerateEventSchema.extend({
  warn: ModWarnSchema.nullable(),
});

export type ChannelModerateV2Event = z.infer<typeof ChannelModerateV2EventSchema>;

// ─── channel.moderator.add ──────────────────────────────────────────────────

export const ChannelModeratorAddEventSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
});

export type ChannelModeratorAddEvent = z.infer<typeof ChannelModeratorAddEventSchema>;

// ─── channel.moderator.remove ───────────────────────────────────────────────

export const ChannelModeratorRemoveEventSchema = ChannelModeratorAddEventSchema;
export type ChannelModeratorRemoveEvent = ChannelModeratorAddEvent;

// ─── channel.warning.send ───────────────────────────────────────────────────

export const ChannelWarningSendEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  moderator_user_id: z.string(),
  moderator_user_login: z.string(),
  moderator_user_name: z.string(),
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  reason: z.string().nullable(),
  chat_rules_cited: z.array(z.string()).nullable(),
});

export type ChannelWarningSendEvent = z.infer<typeof ChannelWarningSendEventSchema>;

// ─── channel.warning.acknowledge ────────────────────────────────────────────

export const ChannelWarningAcknowledgeEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
});

export type ChannelWarningAcknowledgeEvent = z.infer<typeof ChannelWarningAcknowledgeEventSchema>;

// ─── channel.suspicious_user.message ────────────────────────────────────────

const SuspiciousMessageFragmentSchema = z.object({
  type: z.enum(["text", "cheermote", "emote"]),
  text: z.string(),
  cheermote: z
    .object({
      prefix: z.string(),
      bits: z.number().int(),
      tier: z.number().int(),
    })
    .nullable(),
  emote: z
    .object({
      id: z.string(),
      emote_set_id: z.string(),
    })
    .nullable(),
});

export const ChannelSuspiciousUserMessageEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_name: z.string(),
  broadcaster_user_login: z.string(),
  user_id: z.string(),
  user_name: z.string(),
  user_login: z.string(),
  low_trust_status: z.enum(["active_monitoring", "restricted"]),
  shared_ban_channel_ids: z.array(z.string()),
  types: z.array(z.enum(["ban_evader", "shared_ban"])),
  ban_evasion_evaluation: z.enum(["likely", "unlikely", "possible"]),
  message: z.object({
    message_id: z.string(),
    text: z.string(),
    fragments: z.array(SuspiciousMessageFragmentSchema),
  }),
});

export type ChannelSuspiciousUserMessageEvent = z.infer<
  typeof ChannelSuspiciousUserMessageEventSchema
>;

// ─── channel.suspicious_user.update ─────────────────────────────────────────

export const ChannelSuspiciousUserUpdateEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_name: z.string(),
  broadcaster_user_login: z.string(),
  moderator_user_id: z.string(),
  moderator_user_name: z.string(),
  moderator_user_login: z.string(),
  user_id: z.string(),
  user_name: z.string(),
  user_login: z.string(),
  low_trust_status: z.enum(["active_monitoring", "restricted", "none"]),
});

export type ChannelSuspiciousUserUpdateEvent = z.infer<
  typeof ChannelSuspiciousUserUpdateEventSchema
>;

// ─── channel.vip.add ────────────────────────────────────────────────────────

export const ChannelVipAddEventSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
});

export type ChannelVipAddEvent = z.infer<typeof ChannelVipAddEventSchema>;

// ─── channel.vip.remove ─────────────────────────────────────────────────────

export const ChannelVipRemoveEventSchema = ChannelVipAddEventSchema;
export type ChannelVipRemoveEvent = ChannelVipAddEvent;