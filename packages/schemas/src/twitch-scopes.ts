/**
 * Twitch OAuth scopes, grouped by the feature that needs them.
 *
 * `base` is what every account gets at sign-in: the scopes behind the EventSub
 * subscriptions the overlays consume, plus the Helix calls any dashboard page
 * can make. Every other key is a feature set, requested only once the account
 * can actually use that feature, so the consent screen never lists a
 * permission StreamWizard would not exercise for this user.
 *
 * Adding a Helix call or an EventSub type means adding its scope here first.
 * A scope earns its own set only when it is tied to a product; otherwise it
 * belongs in base or it does not belong at all.
 *
 * Twitch issues a token with exactly the scopes of that one authorization (no
 * union with earlier grants), which is why `twitchScopesFor` always starts
 * from base: a feature-only request would hand back a token that breaks chat.
 *
 * @see https://dev.twitch.tv/docs/authentication/scopes
 */
export const TWITCH_SCOPE_SETS = {
  base: [
    // Identity. Supabase's Twitch provider reads the email claim.
    "openid",
    "user:read:email",
    // Chat over EventSub: the channel.chat.* subscriptions run on the
    // broadcaster's own user id, and Send Chat Message as the broadcaster.
    "user:read:chat",
    "user:write:chat",
    "user:bot",
    "channel:bot",
    // Overlay events: channel.follow, .cheer, .subscribe and .subscription.*,
    // .hype_train.*, .ad_break.begin, .channel_points_*, .poll.*, .shoutout.*
    // (manage also covers the bot's Send Shoutout action).
    "moderator:read:followers",
    "bits:read",
    "channel:read:subscriptions",
    "channel:read:hype_train",
    "channel:read:ads",
    "channel:read:redemptions",
    "channel:read:polls",
    "moderator:manage:shoutouts",
    // Bot variables and actions: Get Chatters, Send Chat Announcement.
    "moderator:read:chatters",
    "moderator:manage:announcements",
    // Stream markers (read on the VOD page, created from the deck and the
    // bot) and the deck's title/category editor.
    "user:read:broadcast",
    "channel:manage:broadcast",
    // Clips: Create Clip, Create Clip From VOD, Get Clips Download.
    "clips:edit",
    "channel:manage:clips",
    // The VOD page's delete button.
    "channel:manage:videos",
  ],
  // The cloud OBS instance goes live with the user's own key (rest-api
  // GET /api/nodes/users/:id/stream-key). Only accounts holding the cloud_obs
  // product can use it, so only they are asked for it.
  cloud_obs: ["channel:read:stream_key"],
} as const satisfies Record<string, readonly string[]>;

export type TwitchScopeFeature = Exclude<keyof typeof TWITCH_SCOPE_SETS, "base">;
export type TwitchScope = (typeof TWITCH_SCOPE_SETS)[keyof typeof TWITCH_SCOPE_SETS][number];

/**
 * The product (products.id) that entitles an account to each feature set.
 * The authorize action only requests a set whose product the user holds, so
 * a crafted call cannot widen consent beyond what the account can use.
 */
export const TWITCH_SCOPE_FEATURE_PRODUCTS: Record<TwitchScopeFeature, string> = {
  cloud_obs: "cloud_obs",
};

export const TWITCH_SCOPE_FEATURES = Object.keys(TWITCH_SCOPE_FEATURE_PRODUCTS) as TwitchScopeFeature[];

/** The full scope list to request for an authorization covering `features`. */
export function twitchScopesFor(features: readonly TwitchScopeFeature[]): TwitchScope[] {
  const scopes = new Set<TwitchScope>(TWITCH_SCOPE_SETS.base);
  for (const feature of features) {
    for (const scope of TWITCH_SCOPE_SETS[feature]) scopes.add(scope);
  }
  return [...scopes];
}

/**
 * Which of a feature's scopes the stored token lacks.
 *
 * `granted` is null for an account whose token has not been validated since
 * the scope column was added. Those tokens were issued under the old sign-in,
 * which asked for everything, so null reads as "nothing missing" rather than
 * nagging every existing user until the hourly sweep reaches them.
 */
export function missingTwitchScopes(granted: readonly string[] | null | undefined, feature: TwitchScopeFeature): TwitchScope[] {
  if (granted == null) return [];
  const have = new Set(granted);
  return TWITCH_SCOPE_SETS[feature].filter((scope) => !have.has(scope));
}
