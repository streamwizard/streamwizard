import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getOverlayItemById, getOverlaySceneBySubscriberToken } from "@repo/supabase/queries/overlays";
import type { Json } from "@repo/supabase";
import { isPlausibleToken } from "@/lib/widget-api";

/**
 * Server actions the overlay page calls (clips, custom widgets) run on the
 * service role. They used to take the owner's user id and the item config as
 * arguments, so anyone could call them with another streamer's id and read
 * their clip library or mint signed MP4 URLs. They now take the overlay's own
 * credential instead: the scene's subscriber_token plus the item id. The
 * owner and the config are looked up here, never taken from the caller.
 */

export type AuthorizedOverlayItem = {
  /** The scene owner: the only tenant the action may read. */
  userId: string;
  type: string;
  config: Json;
};

export async function resolveOverlayItem(
  subscriberToken: unknown,
  overlayItemId: unknown,
): Promise<AuthorizedOverlayItem | null> {
  if (!isPlausibleToken(subscriberToken) || typeof overlayItemId !== "string" || !isUuid(overlayItemId)) {
    return null;
  }
  const { data: scene } = await getOverlaySceneBySubscriberToken(supabaseAdmin, subscriberToken);
  if (!scene) return null;
  // Scoped by scene id, so an item from another scene never matches.
  const { data: item } = await getOverlayItemById(supabaseAdmin, overlayItemId, scene.id);
  if (!item) return null;
  return { userId: scene.user_id, type: item.type, config: item.config };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
