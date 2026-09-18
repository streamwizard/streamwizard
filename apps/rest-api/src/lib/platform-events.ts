import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { getPlatformEventIdentityByTwitchUserId, logPlatformEvent } from "@repo/supabase/queries/platform-events";
import type { StreamOnlineFailureReason } from "@repo/types";

// Emitters for the Discord log channel (SW-334) from rest-api. Never throw:
// the thing being logged already happened, and an EventSub handler must not
// fail because a log row didn't land.

/**
 * stream.online arrived but the stream or its VOD couldn't be fetched, so the
 * handler gave up: no VOD row, no live status, no viewer polling. Sentry has
 * the error; this puts it in front of staff.
 */
export async function logStreamOnlineFailed(
  broadcasterId: string,
  reason: StreamOnlineFailureReason,
  streamId: string | null,
): Promise<void> {
  try {
    const { userId, identity } = await getPlatformEventIdentityByTwitchUserId(supabase, broadcasterId);
    await logPlatformEvent(
      supabase,
      { type: "stream.online_failed", subjectUserId: userId, payload: { ...identity, reason, stream_id: streamId } },
      "rest-api platform-events: stream.online_failed",
      { broadcasterUserId: broadcasterId, reason },
    );
  } catch (error) {
    reportError(error, "rest-api platform-events: stream.online_failed", { broadcasterUserId: broadcasterId, reason });
  }
}
