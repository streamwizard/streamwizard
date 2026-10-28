import type { VoiceNamePlaceholder } from "@repo/supabase/queries/discord-voice";

/** Discord's limit for a channel name. */
export const CHANNEL_NAME_MAX = 100;
const FALLBACK_NAME = "Voice channel";

export type ChannelNameValues = Record<VoiceNamePlaceholder, string>;

/**
 * A temp channel's name from its hub's template: `{username}` and
 * `{displayname}` (any capitalisation, spaces inside the braces allowed) are
 * filled in, anything else in braces stays as written. Whitespace collapses
 * and the result is cut to Discord's 100 characters, so a long nickname can
 * never fail the channel create. An empty result falls back to a plain name.
 */
export function renderChannelName(template: string, values: ChannelNameValues): string {
  const filled = template.replace(/\{([^{}]*)\}/g, (match, key: string) => {
    const clean = key.trim().toLowerCase();
    return Object.hasOwn(values, clean) ? values[clean as VoiceNamePlaceholder] : match;
  });
  const name = [...filled.replace(/\s+/g, " ").trim()].slice(0, CHANNEL_NAME_MAX).join("").trim();
  return name || FALLBACK_NAME;
}

/** A name typed into /voice-rename, cleaned the same way. Null when nothing is left. */
export function cleanChannelName(input: string): string | null {
  const name = [...input.replace(/\s+/g, " ").trim()].slice(0, CHANNEL_NAME_MAX).join("").trim();
  return name || null;
}
