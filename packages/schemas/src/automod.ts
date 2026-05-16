import { z } from "zod";

// ─── automod.message.hold (v1) ──────────────────────────────────────────────

export const AutomodMessageHoldEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_name: z.string(),
  broadcaster_user_login: z.string(),
  user_id: z.string(),
  user_name: z.string(),
  user_login: z.string(),
  message_id: z.string(),
  message: z.string(),
  level: z.number().int(),
  category: z.string(),
  held_at: z.string(),
  fragments: z.object({
    emotes: z.array(
      z.object({
        text: z.string(),
        id: z.string(),
        "set-id": z.string(),
      }),
    ),
    cheermotes: z.array(
      z.object({
        text: z.string(),
        amount: z.number().int(),
        prefix: z.string(),
        tier: z.number().int(),
      }),
    ),
  }),
});

export type AutomodMessageHoldEvent = z.infer<typeof AutomodMessageHoldEventSchema>;

// ─── automod.message.hold (v2) ──────────────────────────────────────────────

const AutomodBoundarySchema = z.object({
  start_pos: z.number().int(),
  end_pos: z.number().int(),
});

const AutomodV2FragmentSchema = z.object({
  type: z.enum(["text", "cheermote", "emote"]),
  text: z.string(),
  cheermote: z
    .object({
      prefix: z.string(),
      bits: z.number().int(),
      tier: z.number().int(),
    })
    .nullable(),
  emote: z.null().optional(),
});

export const AutomodMessageHoldV2EventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  message_id: z.string(),
  message: z.object({
    text: z.string(),
    fragments: z.array(AutomodV2FragmentSchema),
  }),
  reason: z.string(),
  automod: z
    .object({
      category: z.string(),
      level: z.number().int(),
      boundaries: z.array(AutomodBoundarySchema),
    })
    .nullable(),
  blocked_term: z.null(),
  held_at: z.string(),
});

export type AutomodMessageHoldV2Event = z.infer<typeof AutomodMessageHoldV2EventSchema>;

// ─── automod.message.update (v1) ────────────────────────────────────────────

export const AutomodMessageUpdateEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_name: z.string(),
  broadcaster_user_login: z.string(),
  user_id: z.string(),
  user_name: z.string(),
  user_login: z.string(),
  moderator_user_id: z.string(),
  moderator_user_login: z.string(),
  moderator_user_name: z.string(),
  message_id: z.string(),
  message: z.string(),
  level: z.number().int(),
  category: z.string(),
  status: z.enum(["approved", "denied", "expired"]),
  held_at: z.string(),
  fragments: z.object({
    emotes: z.array(
      z.object({
        text: z.string(),
        id: z.string(),
        "set-id": z.string(),
      }),
    ),
    cheermotes: z.array(
      z.object({
        text: z.string(),
        amount: z.number().int(),
        prefix: z.string(),
        tier: z.number().int(),
      }),
    ),
  }),
});

export type AutomodMessageUpdateEvent = z.infer<typeof AutomodMessageUpdateEventSchema>;

// ─── automod.message.update (v2) ────────────────────────────────────────────

export const AutomodMessageUpdateV2EventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  moderator_user_id: z.string(),
  moderator_user_login: z.string(),
  moderator_user_name: z.string(),
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  message_id: z.string(),
  message: z.object({
    text: z.string(),
    fragments: z.array(AutomodV2FragmentSchema),
  }),
  reason: z.string(),
  automod: z
    .object({
      category: z.string(),
      level: z.number().int(),
      boundaries: z.array(AutomodBoundarySchema),
    })
    .nullable(),
  blocked_term: z
    .object({
      terms_found: z.array(
        z.object({
          term_id: z.string(),
          owner_broadcaster_user_id: z.string(),
          owner_broadcaster_user_login: z.string(),
          owner_broadcaster_user_name: z.string(),
          boundary: AutomodBoundarySchema,
        }),
      ),
    })
    .nullable(),
  status: z.enum(["approved", "denied", "expired"]),
  held_at: z.string(),
});

export type AutomodMessageUpdateV2Event = z.infer<typeof AutomodMessageUpdateV2EventSchema>;

// ─── automod.settings.update ────────────────────────────────────────────────

export const AutomodSettingsUpdateEventSchema = z.object({
  data: z.array(
    z.object({
      broadcaster_user_id: z.string(),
      broadcaster_user_name: z.string(),
      broadcaster_user_login: z.string(),
      moderator_user_id: z.string(),
      moderator_user_name: z.string(),
      moderator_user_login: z.string(),
      overall_level: z.number().int().nullable(),
      disability: z.number().int(),
      aggression: z.number().int(),
      sexuality_sex_or_gender: z.number().int(),
      misogyny: z.number().int(),
      bullying: z.number().int(),
      swearing: z.number().int(),
      race_ethnicity_or_religion: z.number().int(),
      sex_based_terms: z.number().int(),
    }),
  ),
});

export type AutomodSettingsUpdateEvent = z.infer<typeof AutomodSettingsUpdateEventSchema>;

// ─── automod.terms.update ───────────────────────────────────────────────────

export const AutomodTermsUpdateEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_name: z.string(),
  broadcaster_user_login: z.string(),
  moderator_user_id: z.string(),
  moderator_user_login: z.string(),
  moderator_user_name: z.string(),
  action: z.string(),
  from_automod: z.boolean(),
  terms: z.array(z.string()),
});

export type AutomodTermsUpdateEvent = z.infer<typeof AutomodTermsUpdateEventSchema>;