import { z } from "zod";

// Safe to import from client components: data and pure helpers only.

const CUSTOM_EMOJI = /^<a?:\w{2,32}:\d{17,20}>$/;

/** One emoji and nothing else: "🐛", a flag, a skin-toned or joined sequence. */
function isSingleUnicodeEmoji(value: string): boolean {
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)];
  return graphemes.length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(value);
}

/**
 * What Discord accepts on a button or select option: one standard emoji, or a
 * server emoji written as <:name:id>. Anything else makes Discord reject the
 * whole message, so it is caught here. Empty means no emoji.
 */
export const ticketEmojiSchema = z
  .string()
  .trim()
  .max(64)
  .nullable()
  .transform((value) => value || null)
  .refine((value) => value === null || CUSTOM_EMOJI.test(value) || isSingleUnicodeEmoji(value), {
    message: "Use a single emoji, or a server emoji written as <:name:id>.",
  });

/** A custom emoji can't be drawn outside Discord, so the dashboard shows its name instead. */
export function emojiForDisplay(emoji: string | null): string | null {
  if (!emoji) return null;
  const custom = /^<a?:(\w+):\d+>$/.exec(emoji);
  return custom ? `:${custom[1]}:` : emoji;
}
