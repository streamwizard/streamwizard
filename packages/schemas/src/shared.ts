import { z } from "zod";

// ─── Reusable primitives ────────────────────────────────────────────────────

export const BadgeSchema = z.object({
  set_id: z.string(),
  id: z.string(),
  info: z.string(),
});

export const BroadcasterSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
});

export const UserSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
});

export const ModeratorSchema = z.object({
  moderator_user_id: z.string(),
  moderator_user_login: z.string(),
  moderator_user_name: z.string(),
});

export const CurrencyAmountSchema = z.object({
  value: z.number().int(),
  decimal_places: z.number().int(),
  currency: z.string(),
});

export const MessageFragmentSchema = z.object({
  type: z.enum(["text", "cheermote", "emote", "mention"]),
  text: z.string(),
  cheermote: z
    .object({
      prefix: z.string(),
      bits: z.number().int(),
      tier: z.number().int(),
    })
    .nullable()
    .optional(),
  emote: z
    .object({
      id: z.string(),
      emote_set_id: z.string(),
    })
    .nullable()
    .optional(),
});

export const ChatMessageSchema = z.object({
  text: z.string(),
  fragments: z.array(MessageFragmentSchema),
});

export type Badge = z.infer<typeof BadgeSchema>;
export type Broadcaster = z.infer<typeof BroadcasterSchema>;
export type User = z.infer<typeof UserSchema>;
export type Moderator = z.infer<typeof ModeratorSchema>;
export type CurrencyAmount = z.infer<typeof CurrencyAmountSchema>;
export type MessageFragment = z.infer<typeof MessageFragmentSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;