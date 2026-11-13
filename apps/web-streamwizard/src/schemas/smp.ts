import { z } from "zod";

/*
 * The Minecraft SMP sign-up on /smp. One file for the form and the server
 * action, so the browser and the server agree on what a valid answer is.
 */

/** Minecraft Java names: 3 to 16 letters, digits or underscores. The table has the same check. */
export const MINECRAFT_USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

/**
 * Stream languages, keyed by the code Twitch uses for a channel's language, so
 * the form can start on what the channel is already set to.
 */
export const SMP_STREAM_LANGUAGES = {
  en: "English",
  nl: "Dutch",
  de: "German",
  fr: "French",
  es: "Spanish",
  pt: "Portuguese",
  it: "Italian",
  pl: "Polish",
  tr: "Turkish",
  ru: "Russian",
  uk: "Ukrainian",
  sv: "Swedish",
  da: "Danish",
  no: "Norwegian",
  fi: "Finnish",
  cs: "Czech",
  hu: "Hungarian",
  ro: "Romanian",
  el: "Greek",
  ar: "Arabic",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  id: "Indonesian",
  th: "Thai",
  other: "Another language",
} as const;

export type SmpStreamLanguage = keyof typeof SMP_STREAM_LANGUAGES;

export const SMP_STREAM_FREQUENCIES = {
  most_days: "Most days",
  few_per_week: "A few times a week",
  weekly: "About once a week",
  less_than_weekly: "Less than once a week",
} as const;

export type SmpStreamFrequency = keyof typeof SMP_STREAM_FREQUENCIES;

const keysOf = <T extends Record<string, string>>(record: T) => Object.keys(record) as [keyof T & string, ...(keyof T & string)[]];

/** The language to start the form on: the channel's own, when it is one we list. */
export function toSmpStreamLanguage(code: string | null | undefined): SmpStreamLanguage | null {
  return code && Object.hasOwn(SMP_STREAM_LANGUAGES, code) ? (code as SmpStreamLanguage) : null;
}

const minecraftUsername = z
  .string({ error: "Enter your Minecraft name." })
  .trim()
  .max(16, "A Minecraft name is 16 characters at most.")
  .regex(MINECRAFT_USERNAME_PATTERN, "A Minecraft name is 3 to 16 letters, numbers or underscores.");

/** Editing the name after sign-up. */
export const minecraftNameSchema = z.object({ minecraftUsername });

export const smpWaitlistSchema = minecraftNameSchema.extend({
  averageViewers: z
    .number({ error: "Enter your average viewers as a number." })
    .int("Use a whole number for your average viewers.")
    .min(0, "Average viewers can't be below zero.")
    .max(1_000_000, "That's more viewers than we can believe."),
  streamLanguage: z.enum(keysOf(SMP_STREAM_LANGUAGES), { error: "Pick the language you stream in." }),
  streamFrequency: z.enum(keysOf(SMP_STREAM_FREQUENCIES), { error: "Pick how often you stream." }),
});

export type MinecraftNameInput = z.infer<typeof minecraftNameSchema>;
export type SmpWaitlistInput = z.infer<typeof smpWaitlistSchema>;

/** `?discordRole=` as the Discord callback sets it when the Verified Member role did not land. */
export const discordRoleNoticeSchema = z.enum(["pending_membership", "failed"]);
