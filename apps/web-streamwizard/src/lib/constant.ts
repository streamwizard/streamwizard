/**
 * Twitch OAuth scopes requested at sign-in (`actions/auth/login.ts`).
 * Each scope maps to a product surface; do not add scopes without a corresponding feature.
 *
 * @see https://dev.twitch.tv/docs/authentication/scopes
 */
export const TWITCH_SCOPES = [
  // Identity & account
  "openid",
  "user:read:email",
  "user:read:follows",
  "user:edit",
  // Chat & bot
  "user:bot",
  "user:read:chat",
  "user:write:chat",
  "channel:bot",
  // Broadcast & stream state
  "user:read:broadcast",
  "channel:manage:broadcast",
  "channel:read:hype_train",
  // Moderation tools
  "moderator:manage:shoutouts",
  "moderator:manage:shield_mode",
  "moderator:read:followers",
  "moderator:read:chatters",
  // Channel engagement (subs, raids, polls, redemptions, ads, bits)
  "channel:read:subscriptions",
  "channel:manage:redemptions",
  "channel:manage:raids",
  "channel:manage:polls",
  "channel:manage:ads",
  "channel:read:ads",
  "bits:read",
  // Clips (clip management & sync)
  "editor:manage:clips",
  "channel:manage:clips",
] as const;

export const discordInviteLink = "https://discord.gg/29Eq659egv";
export const discordDocsLink = "https://docs.streamwizard.org/discord";
export const githubLink = "https://github.com/streamwizard/streamwizard-backend";
