import { z } from "zod";
import { isPlatformEventType } from "@repo/schemas/platform-events";
import { SNOWFLAKE_PATTERN } from "@repo/schemas/ids";
import {
  VOICE_NAME_TEMPLATE_MAX,
  VOICE_STAFF_ROLES_MAX,
  VOICE_USER_LIMIT_MAX,
} from "@repo/supabase/queries/discord/voice";
import { isValidTimeZone, WORKING_DAYS, WORKING_RANGES_PER_DAY } from "@repo/supabase/queries/tickets/hours";
import {
  TICKET_COOLDOWN_MAX_SECONDS,
  TICKET_LIMIT_MAX,
  TICKET_SLOWMODE_MAX_SECONDS,
} from "@repo/supabase/queries/tickets/config";
import {
  TICKET_TAG_CONTENT_MAX,
  TICKET_TAG_KEYWORD_MAX,
  TICKET_TAG_KEYWORDS_MAX,
  TICKET_TAG_NAME_PATTERN,
} from "@repo/supabase/queries/tickets/tags";

// The Discord dashboard's action inputs that a client form also types its
// draft with. Schemas only one action file uses stay in that file.

/** A Discord snowflake id. */
export const snowflakeSchema = z.string().regex(SNOWFLAKE_PATTERN, "That isn't a Discord id");
export const nullableSnowflakeSchema = snowflakeSchema.nullable();

// Settings pages --------------------------------------------------------------

export const activitySettingsSchema = z.object({
  trackingEnabled: z.boolean(),
  trackMessages: z.boolean(),
  trackReactions: z.boolean(),
  trackVoice: z.boolean(),
  voiceIgnoreAfk: z.boolean(),
  voiceRequireOthers: z.boolean(),
  ignoredChannelIds: z.array(snowflakeSchema).max(500),
});
export type ActivitySettingsInput = z.infer<typeof activitySettingsSchema>;

export const liveSettingsSchema = z.object({
  liveEnabled: z.boolean(),
  liveChannelId: nullableSnowflakeSchema,
  liveRoleId: nullableSnowflakeSchema,
});
export type LiveSettingsInput = z.infer<typeof liveSettingsSchema>;

export const welcomeSettingsSchema = z.object({
  welcomeEnabled: z.boolean(),
  welcomeChannelId: nullableSnowflakeSchema,
  verifiedRoleId: nullableSnowflakeSchema,
  joinRoleId: nullableSnowflakeSchema,
});
export type WelcomeSettingsInput = z.infer<typeof welcomeSettingsSchema>;

export const logSettingsSchema = z.object({
  defaultChannelId: nullableSnowflakeSchema,
  ignoredChannelIds: z.array(snowflakeSchema).max(100),
  events: z.record(
    z.string().max(64).refine((type): boolean => isPlatformEventType(type), "Unknown event type"),
    z.object({ enabled: z.boolean(), channelId: nullableSnowflakeSchema }),
  ),
});
export type LogSettingsInput = z.infer<typeof logSettingsSchema>;

// Tickets ---------------------------------------------------------------------

export const ticketSettingsSchema = z
  .object({
    enabled: z.boolean(),
    staffRoleId: nullableSnowflakeSchema,
    categoryId: nullableSnowflakeSchema,
    panelChannelId: nullableSnowflakeSchema,
    blockedRoleIds: z.array(snowflakeSchema).max(25),
    maxOpenPerUser: z.number().int().min(1).max(50).nullable(),
    claimHidesFromOtherStaff: z.boolean(),
    closeOnMemberLeave: z.boolean(),
    dmOnClose: z.boolean(),
    dmOpenEnabled: z.boolean(),
  })
  .refine((v) => !v.enabled || (v.staffRoleId && v.categoryId && v.panelChannelId), {
    message: "Tickets need a staff role, a category and a panel channel before you can turn them on.",
  });
export type TicketSettingsInput = z.infer<typeof ticketSettingsSchema>;

const HOURS_MAX = 24 * 365;
const hoursSchema = z.number().int().min(1).max(HOURS_MAX).nullable();
const clockSchema = z.string().regex(/^\d{2}:\d{2}$/);
const rangeSchema = z.object({ start: clockSchema, end: clockSchema });

export const ticketAutomationSchema = z
  .object({
    staleAfterHours: hoursSchema,
    autoCloseAfterHours: hoursSchema,
    closeMode: z.enum(["staff_only", "request", "either"]),
    closeRequestHours: z.number().int().min(1).max(HOURS_MAX),
    workingHours: z.object({
      timezone: z.string().max(64).refine(isValidTimeZone, "Pick a time zone"),
      days: z.object(Object.fromEntries(WORKING_DAYS.map((day) => [day, z.array(rangeSchema).max(WORKING_RANGES_PER_DAY)]))),
    }),
  })
  // Auto-close counts from the reminder, so it can't exist without one.
  .transform((v) => (v.staleAfterHours === null ? { ...v, autoCloseAfterHours: null } : v));
export type TicketAutomationInput = z.input<typeof ticketAutomationSchema>;

const ticketRoleList = z.array(snowflakeSchema).max(25);
const ticketLimit = z.number().int().min(1).max(TICKET_LIMIT_MAX).nullable();

export const ticketCategoryRulesSchema = z.object({
  staffRoleIds: ticketRoleList,
  pingRoleIds: ticketRoleList,
  requiredRoleIds: ticketRoleList,
  memberLimit: ticketLimit,
  totalLimit: ticketLimit,
  cooldownSeconds: z.number().int().min(0).max(TICKET_COOLDOWN_MAX_SECONDS),
  slowmodeSeconds: z.number().int().min(0).max(TICKET_SLOWMODE_MAX_SECONDS),
  claimingEnabled: z.boolean(),
  feedbackEnabled: z.boolean(),
  channelNameTemplate: z
    .string()
    .trim()
    .min(1, "The channel name can't be empty.")
    .max(100)
    // Discord would make these dashes anyway; saying so now beats a surprise in the channel list.
    .regex(/^[a-z0-9_\-[\].]+$/, "Channel names take lowercase letters, digits, dashes and the [variables]."),
});
export type TicketCategoryRulesInput = z.infer<typeof ticketCategoryRulesSchema>;

export const ticketTagSchema = z.object({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .regex(TICKET_TAG_NAME_PATTERN, "Names are lowercase letters, digits, dashes and underscores, up to 32 characters."),
  content: z.string().trim().min(1, "Write the answer first.").max(TICKET_TAG_CONTENT_MAX),
  triggerKeywords: z
    .array(z.string().trim().max(TICKET_TAG_KEYWORD_MAX))
    .max(TICKET_TAG_KEYWORDS_MAX, `At most ${TICKET_TAG_KEYWORDS_MAX} keywords.`),
  autoReply: z.boolean(),
});
export type TicketTagFormInput = z.infer<typeof ticketTagSchema>;

/**
 * What staff can do to an open ticket from its page, and what each change
 * takes. The bot runs the same action the slash command does.
 */
export const ticketChangeSchemas = {
  release: z.object({}),
  priority: z.object({ priority: z.enum(["low", "medium", "high"]).nullable() }),
  subject: z.object({ subject: z.string().trim().min(1, "The subject can't be empty").max(100) }),
  move: z.object({ category: z.string().regex(/^[a-z0-9_]{1,32}$/) }),
  "members/add": z.object({ targetDiscordUserId: snowflakeSchema }),
  "members/remove": z.object({ targetDiscordUserId: snowflakeSchema, targetName: z.string().max(100).optional() }),
  transfer: z.object({ targetDiscordUserId: snowflakeSchema }),
  // The opener's close request: accepting closes the ticket, rejecting keeps it open.
  "close-accept": z.object({}),
  "close-reject": z.object({}),
} as const;
export type TicketChange = keyof typeof ticketChangeSchemas;
export type TicketChangeInput<K extends TicketChange> = z.input<(typeof ticketChangeSchemas)[K]>;

// Voice -----------------------------------------------------------------------

export const voiceStaffRolesSchema = z
  .array(snowflakeSchema)
  .max(VOICE_STAFF_ROLES_MAX, `That's more than ${VOICE_STAFF_ROLES_MAX} staff roles.`)
  .transform((ids) => [...new Set(ids)]);

export const voiceHubSchema = z.object({
  lobbyChannelId: snowflakeSchema,
  categoryId: nullableSnowflakeSchema,
  nameTemplate: z
    .string()
    .trim()
    .min(1, "Give the channels a name.")
    .max(VOICE_NAME_TEMPLATE_MAX, `Names stop at ${VOICE_NAME_TEMPLATE_MAX} characters.`),
  defaultUserLimit: z
    .number()
    .int()
    .min(0)
    .max(VOICE_USER_LIMIT_MAX, `Discord stops at ${VOICE_USER_LIMIT_MAX} people.`),
  /** Null: the hub uses the server's voice staff roles. */
  staffRoleIds: voiceStaffRolesSchema.nullable(),
  rememberOwnerSettings: z.boolean(),
});
export type VoiceHubFormInput = z.infer<typeof voiceHubSchema>;
