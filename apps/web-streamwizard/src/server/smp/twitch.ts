import "server-only";

import { TwitchApi } from "@repo/twitch-api";
import { reportError } from "@repo/sentry";
import { toSmpStreamLanguage, type SmpStreamLanguage } from "@/schemas/smp";
import type { SmpBroadcasterType, SmpTwitchSnapshot } from "@/server/smp/apply";

/*
 * What the SMP sign-up reads from Twitch so it does not have to ask: the
 * channel's language (to start the form on) and, at submit, the broadcaster
 * type and follower count. All of it is best effort. Helix has no timeout of
 * its own here, so each read gets a cap, and a slow or failed read costs the
 * streamer nothing: the field starts empty, or the snapshot column stays null.
 */

const LANGUAGE_TIMEOUT_MS = 1_500;
const SNAPSHOT_TIMEOUT_MS = 4_000;

/** The value, or null when the read fails or takes longer than `ms`. Failures are reported; timeouts are not. */
async function within<T>(read: Promise<T>, ms: number, context: string): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([read, timeout]);
  } catch (error) {
    reportError(error, context);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getSmpStreamLanguage(broadcasterId: string): Promise<SmpStreamLanguage | null> {
  const info = await within(
    new TwitchApi(broadcasterId).channels.getChannelInformation(broadcasterId),
    LANGUAGE_TIMEOUT_MS,
    "smp.twitch.language",
  );
  return toSmpStreamLanguage(info?.broadcaster_language);
}

/** Twitch sends "" for a channel that is neither affiliate nor partner. */
function toBroadcasterType(value: string | undefined): SmpBroadcasterType | null {
  if (value === "affiliate" || value === "partner") return value;
  return value === "" ? "none" : null;
}

export async function getSmpTwitchSnapshot(broadcasterId: string): Promise<SmpTwitchSnapshot> {
  const api = new TwitchApi(broadcasterId);
  const [user, followerCount] = await Promise.all([
    within(api.search.lookupUser(broadcasterId), SNAPSHOT_TIMEOUT_MS, "smp.twitch.user"),
    // The streamer's own token: the login scopes include reading followers.
    within(api.followers.getFollowerCount(), SNAPSHOT_TIMEOUT_MS, "smp.twitch.followers"),
  ]);
  return {
    broadcasterType: toBroadcasterType(user?.broadcaster_type),
    followerCount: typeof followerCount === "number" && followerCount >= 0 ? followerCount : null,
  };
}
