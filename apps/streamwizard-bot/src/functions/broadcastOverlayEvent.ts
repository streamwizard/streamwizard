import type { OverlayEventType } from "@repo/types";
import { supabase } from "@repo/supabase";
import { getTwitchIntegrationByBroadcasterId } from "@repo/supabase/queries/user";
import { overlayWsClient } from "../overlay-ws-client";
import { enrichOverlayEvent } from "./enrichOverlayEvent";

// broadcaster_user_id (Twitch) → supabase user_id
const userIdCache = new Map<string, string>();

async function resolveUserId(broadcasterId: string): Promise<string | null> {
  const cached = userIdCache.get(broadcasterId);
  if (cached) return cached;

  const { data } = await getTwitchIntegrationByBroadcasterId(supabase, broadcasterId);
  if (!data?.user_id) return null;

  userIdCache.set(broadcasterId, data.user_id);
  return data.user_id;
}

export async function broadcastOverlayEvent(
  broadcasterId: string,
  type: OverlayEventType,
  payload: unknown
): Promise<void> {
  const userId = await resolveUserId(broadcasterId);
  if (!userId) return;

  // Adds badge image URLs and the subject's avatar when they're already
  // cached. Cache-only and additive, so this never delays the broadcast and
  // never changes a field a widget already reads.
  overlayWsClient.send({
    userId,
    type,
    payload: enrichOverlayEvent(broadcasterId, type, payload),
  });
}
