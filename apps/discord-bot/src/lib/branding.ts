/** Embed accent used across every StreamWizard-authored Discord message. */
export const TWITCH_PURPLE = 0x9146ff;

/**
 * Destructive events in the log channel (account deleted, plan revoked,
 * Discord unlinked). Hex of the light `--destructive` token, because semantic
 * meaning beats brand (docs/branding.md §4).
 */
export const DANGER_RED = 0xe7000b;

/**
 * Discord-native utilities: welcome, stats, rank, and the server log (member,
 * message, role and channel events). Destructive server events use DANGER_RED.
 */
export const DISCORD_BLURPLE = 0x5865f2;
