import { z } from "zod";
import { CurrencyAmountSchema } from "./shared";

// ─── channel.hype_train.begin / progress / end ───────────────────────────────

const HypeTrainContributionSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  type: z.enum(["bits", "subscription", "other"]),
  total: z.number().int(),
});

const HypeTrainBaseSchema = z.object({
  id: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  total: z.number().int(),
  top_contributions: z.array(HypeTrainContributionSchema),
  shared_train_participants: z.unknown().nullable(),
  level: z.number().int(),
  started_at: z.string(),
  is_shared_train: z.boolean(),
  type: z.string(),
});

export const ChannelHypeTrainBeginEventSchema = HypeTrainBaseSchema.extend({
  progress: z.number().int(),
  goal: z.number().int(),
  expires_at: z.string(),
  all_time_high_level: z.number().int().optional(),
  all_time_high_total: z.number().int().optional(),
});

export type ChannelHypeTrainBeginEvent = z.infer<typeof ChannelHypeTrainBeginEventSchema>;

export const ChannelHypeTrainProgressEventSchema = HypeTrainBaseSchema.extend({
  progress: z.number().int(),
  goal: z.number().int(),
  expires_at: z.string(),
});

export type ChannelHypeTrainProgressEvent = z.infer<typeof ChannelHypeTrainProgressEventSchema>;

export const ChannelHypeTrainEndEventSchema = HypeTrainBaseSchema.extend({
  ended_at: z.string(),
  cooldown_ends_at: z.string(),
});

export type ChannelHypeTrainEndEvent = z.infer<typeof ChannelHypeTrainEndEventSchema>;

// ─── channel.shield_mode.begin / end ────────────────────────────────────────

const ShieldModeBaseSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_name: z.string(),
  broadcaster_user_login: z.string(),
  moderator_user_id: z.string(),
  moderator_user_name: z.string(),
  moderator_user_login: z.string(),
});

export const ChannelShieldModeBeginEventSchema = ShieldModeBaseSchema.extend({
  started_at: z.string(),
});

export type ChannelShieldModeBeginEvent = z.infer<typeof ChannelShieldModeBeginEventSchema>;

export const ChannelShieldModeEndEventSchema = ShieldModeBaseSchema.extend({
  ended_at: z.string(),
});

export type ChannelShieldModeEndEvent = z.infer<typeof ChannelShieldModeEndEventSchema>;

// ─── channel.shoutout.create ─────────────────────────────────────────────────

export const ChannelShoutoutCreateEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_name: z.string(),
  broadcaster_user_login: z.string(),
  moderator_user_id: z.string(),
  moderator_user_name: z.string(),
  moderator_user_login: z.string(),
  to_broadcaster_user_id: z.string(),
  to_broadcaster_user_name: z.string(),
  to_broadcaster_user_login: z.string(),
  started_at: z.string(),
  viewer_count: z.number().int(),
  cooldown_ends_at: z.string(),
  target_cooldown_ends_at: z.string(),
});

export type ChannelShoutoutCreateEvent = z.infer<typeof ChannelShoutoutCreateEventSchema>;

// ─── channel.shoutout.receive ────────────────────────────────────────────────

export const ChannelShoutoutReceiveEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_name: z.string(),
  broadcaster_user_login: z.string(),
  from_broadcaster_user_id: z.string(),
  from_broadcaster_user_name: z.string(),
  from_broadcaster_user_login: z.string(),
  viewer_count: z.number().int(),
  started_at: z.string(),
});

export type ChannelShoutoutReceiveEvent = z.infer<typeof ChannelShoutoutReceiveEventSchema>;

// ─── channel.charity_campaign.donate ────────────────────────────────────────

export const ChannelCharityDonateEventSchema = z.object({
  id: z.string(),
  campaign_id: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_name: z.string(),
  broadcaster_user_login: z.string(),
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  charity_name: z.string(),
  charity_description: z.string(),
  charity_logo: z.string(),
  charity_website: z.string(),
  amount: CurrencyAmountSchema,
});

export type ChannelCharityDonateEvent = z.infer<typeof ChannelCharityDonateEventSchema>;

// ─── channel.charity_campaign.start ─────────────────────────────────────────

export const ChannelCharityCampaignStartEventSchema = z.object({
  id: z.string(),
  broadcaster_id: z.string(),
  broadcaster_name: z.string(),
  broadcaster_login: z.string(),
  charity_name: z.string(),
  charity_description: z.string(),
  charity_logo: z.string(),
  charity_website: z.string(),
  current_amount: CurrencyAmountSchema,
  target_amount: CurrencyAmountSchema,
  started_at: z.string(),
});

export type ChannelCharityCampaignStartEvent = z.infer<
  typeof ChannelCharityCampaignStartEventSchema
>;

// ─── channel.charity_campaign.progress ──────────────────────────────────────

export const ChannelCharityCampaignProgressEventSchema = z.object({
  id: z.string(),
  broadcaster_id: z.string(),
  broadcaster_name: z.string(),
  broadcaster_login: z.string(),
  charity_name: z.string(),
  charity_description: z.string(),
  charity_logo: z.string(),
  charity_website: z.string(),
  current_amount: CurrencyAmountSchema,
  target_amount: CurrencyAmountSchema,
});

export type ChannelCharityCampaignProgressEvent = z.infer<
  typeof ChannelCharityCampaignProgressEventSchema
>;

// ─── channel.charity_campaign.stop ──────────────────────────────────────────

export const ChannelCharityCampaignStopEventSchema =
  ChannelCharityCampaignProgressEventSchema.extend({
    stopped_at: z.string(),
  });

export type ChannelCharityCampaignStopEvent = z.infer<typeof ChannelCharityCampaignStopEventSchema>;

// ─── channel.shared_chat.begin / update / end ───────────────────────────────

const SharedChatParticipantSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_name: z.string(),
  broadcaster_user_login: z.string(),
});

const SharedChatSessionBaseSchema = z.object({
  session_id: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  host_broadcaster_user_id: z.string(),
  host_broadcaster_user_login: z.string(),
  host_broadcaster_user_name: z.string(),
});

export const ChannelSharedChatBeginEventSchema = SharedChatSessionBaseSchema.extend({
  participants: z.array(SharedChatParticipantSchema),
});

export type ChannelSharedChatBeginEvent = z.infer<typeof ChannelSharedChatBeginEventSchema>;

export const ChannelSharedChatUpdateEventSchema = SharedChatSessionBaseSchema.extend({
  participants: z.array(SharedChatParticipantSchema),
});

export type ChannelSharedChatUpdateEvent = z.infer<typeof ChannelSharedChatUpdateEventSchema>;

export const ChannelSharedChatEndEventSchema = SharedChatSessionBaseSchema;
export type ChannelSharedChatEndEvent = z.infer<typeof ChannelSharedChatEndEventSchema>;

// ─── channel.goal.begin / progress / end ────────────────────────────────────

const GoalBaseSchema = z.object({
  id: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_name: z.string(),
  broadcaster_user_login: z.string(),
  type: z.enum(["follow", "subscription", "subscription_count", "new_subscription", "new_subscription_count"]),
  description: z.string(),
  current_amount: z.number().int(),
  target_amount: z.number().int(),
  started_at: z.string(),
});

export const ChannelGoalBeginEventSchema = GoalBaseSchema;
export type ChannelGoalBeginEvent = z.infer<typeof ChannelGoalBeginEventSchema>;

export const ChannelGoalProgressEventSchema = GoalBaseSchema;
export type ChannelGoalProgressEvent = z.infer<typeof ChannelGoalProgressEventSchema>;

export const ChannelGoalEndEventSchema = GoalBaseSchema.extend({
  is_achieved: z.boolean(),
  ended_at: z.string(),
});

export type ChannelGoalEndEvent = z.infer<typeof ChannelGoalEndEventSchema>;