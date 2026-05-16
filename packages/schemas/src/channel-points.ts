import { z } from "zod";

// ─── Shared reward image schema ──────────────────────────────────────────────

const RewardImageSchema = z.object({
  url_1x: z.string(),
  url_2x: z.string(),
  url_4x: z.string(),
});

const RewardMaxSchema = z.object({
  is_enabled: z.boolean(),
  value: z.number().int(),
});

const RewardCooldownSchema = z.object({
  is_enabled: z.boolean(),
  seconds: z.number().int(),
});

// ─── Shared full custom reward fields ───────────────────────────────────────

const CustomRewardBaseSchema = z.object({
  id: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  is_enabled: z.boolean(),
  is_paused: z.boolean(),
  is_in_stock: z.boolean(),
  title: z.string(),
  cost: z.number().int(),
  prompt: z.string(),
  is_user_input_required: z.boolean(),
  should_redemptions_skip_request_queue: z.boolean(),
  cooldown_expires_at: z.string().nullable(),
  redemptions_redeemed_current_stream: z.number().int().nullable(),
  max_per_stream: RewardMaxSchema,
  max_per_user_per_stream: RewardMaxSchema,
  global_cooldown: RewardCooldownSchema,
  background_color: z.string(),
  image: RewardImageSchema.nullable(),
  default_image: RewardImageSchema,
});

// ─── channel.channel_points_automatic_reward_redemption.add (v1) ────────────

export const ChannelPointsAutomaticRewardRedemptionAddEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_name: z.string(),
  broadcaster_user_login: z.string(),
  user_id: z.string(),
  user_name: z.string(),
  user_login: z.string(),
  id: z.string(),
  reward: z.object({
    type: z.string(),
    cost: z.number().int(),
    unlocked_emote: z.unknown().nullable(),
  }),
  message: z.object({
    text: z.string(),
    emotes: z.array(
      z.object({
        id: z.string(),
        begin: z.number().int(),
        end: z.number().int(),
      }),
    ),
  }),
  user_input: z.string(),
  redeemed_at: z.string(),
});

export type ChannelPointsAutomaticRewardRedemptionAddEvent = z.infer<
  typeof ChannelPointsAutomaticRewardRedemptionAddEventSchema
>;

// ─── channel.channel_points_automatic_reward_redemption.add (v2) ────────────

const V2EmoteFragmentSchema = z.object({
  type: z.enum(["text", "emote"]),
  text: z.string(),
  emote: z
    .object({
      id: z.string(),
    })
    .nullable(),
});

export const ChannelPointsAutomaticRewardRedemptionAddV2EventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_name: z.string(),
  broadcaster_user_login: z.string(),
  user_id: z.string(),
  user_name: z.string(),
  user_login: z.string(),
  id: z.string(),
  reward: z.object({
    type: z.string(),
    channel_points: z.number().int(),
    emote: z.unknown().nullable(),
  }),
  message: z.object({
    text: z.string(),
    fragments: z.array(V2EmoteFragmentSchema),
  }),
  redeemed_at: z.string(),
});

export type ChannelPointsAutomaticRewardRedemptionAddV2Event = z.infer<
  typeof ChannelPointsAutomaticRewardRedemptionAddV2EventSchema
>;

// ─── channel.channel_points_custom_reward.add ───────────────────────────────

export const ChannelPointsCustomRewardAddEventSchema = CustomRewardBaseSchema;
export type ChannelPointsCustomRewardAddEvent = z.infer<
  typeof ChannelPointsCustomRewardAddEventSchema
>;

// ─── channel.channel_points_custom_reward.update ────────────────────────────

export const ChannelPointsCustomRewardUpdateEventSchema = CustomRewardBaseSchema;
export type ChannelPointsCustomRewardUpdateEvent = z.infer<
  typeof ChannelPointsCustomRewardUpdateEventSchema
>;

// ─── channel.channel_points_custom_reward.remove ────────────────────────────

export const ChannelPointsCustomRewardRemoveEventSchema = CustomRewardBaseSchema;
export type ChannelPointsCustomRewardRemoveEvent = z.infer<
  typeof ChannelPointsCustomRewardRemoveEventSchema
>;

// ─── channel.channel_points_custom_reward_redemption.add ────────────────────

const RedemptionRewardSchema = z.object({
  id: z.string(),
  title: z.string(),
  cost: z.number().int(),
  prompt: z.string(),
});

export const ChannelPointsCustomRewardRedemptionAddEventSchema = z.object({
  id: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  user_input: z.string(),
  status: z.enum(["unfulfilled", "fulfilled", "canceled"]),
  reward: RedemptionRewardSchema,
  redeemed_at: z.string(),
});

export type ChannelPointsCustomRewardRedemptionAddEvent = z.infer<
  typeof ChannelPointsCustomRewardRedemptionAddEventSchema
>;

// ─── channel.channel_points_custom_reward_redemption.update ─────────────────

export const ChannelPointsCustomRewardRedemptionUpdateEventSchema =
  ChannelPointsCustomRewardRedemptionAddEventSchema;
export type ChannelPointsCustomRewardRedemptionUpdateEvent =
  ChannelPointsCustomRewardRedemptionAddEvent;

// ─── channel.custom_power_up_redemption.add (BETA) ──────────────────────────

export const ChannelCustomPowerUpRedemptionAddEventSchema = z.object({
  id: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  user_input: z.string(),
  status: z.enum(["unfulfilled", "fulfilled", "canceled"]),
  custom_power_up: z.object({
    id: z.string(),
    title: z.string(),
    bits: z.number().int(),
    prompt: z.string(),
  }),
  redeemed_at: z.string(),
});

export type ChannelCustomPowerUpRedemptionAddEvent = z.infer<
  typeof ChannelCustomPowerUpRedemptionAddEventSchema
>;