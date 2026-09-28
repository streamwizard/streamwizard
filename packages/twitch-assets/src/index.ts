/**
 * Twitch presentation assets for overlay widgets.
 *
 * Widgets can't call Helix — no credentials, and the iframe CSP blocks the
 * origin — so everything they need to turn an EventSub id into a picture comes
 * through here, via /api/twitch/* on the overlay origin.
 *
 * The split that matters:
 *   assets.ts — cached in Supabase with a TTL. Stale = an old picture.
 *   live.ts   — never cached. Stale = a wrong number on screen.
 */

export {
  resolveBadges,
  peekBadges,
  peekBadgesCached,
  warmBadges,
  resolveCheermotes,
  peekCheermotes,
  warmCheermotes,
  resolveUser,
  resolveUsers,
  peekUser,
  peekUserCached,
  warmUser,
  resolveGame,
} from "./assets";

export { liveFollowerTotal, liveSubscriberTotal, liveStream, liveGoals, livePoll, liveAdSchedule } from "./live";
export { toPublicAdSchedule, adTime } from "./ads";
export { liveCredits, type CreditsOptions } from "./credits";
export { liveLabels } from "./labels";
export { toPublicPoll, RECENT_POLL_MS } from "./polls";

export {
  resolveThirdPartyEmotes,
  resolveChannelEmotes,
  resolveGlobalTwitchEmotes,
  isThirdPartyProvider,
  THIRD_PARTY_PROVIDERS,
} from "./third-party-emotes";

export {
  resolveEmoteLibrary,
  searchEmotes,
  isEmoteSearchProvider,
  type EmoteLibrarySection,
  type EmoteSearchProvider,
  type LibraryEmote,
} from "./emote-library";

export { ASSET_TTL } from "./cache";

export type {
  BadgeImage,
  ChannelEmote,
  ChannelEmoteMap,
  BadgeMap,
  CheermoteMap,
  CheermoteTier,
  LiveAdSchedule,
  LiveGoals,
  PublicAdSchedule,
  LivePoll,
  PublicPoll,
  PublicPollChoice,
  PublicPollStatus,
  PublicGoal,
  PublicGoalType,
  PublicGame,
  PublicStream,
  PublicUser,
  ThirdPartyEmote,
  ThirdPartyEmoteMap,
  ThirdPartyProvider,
} from "./types";
