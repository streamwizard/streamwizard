const CONDITION_KEYS = ["to_broadcaster_user_id", "broadcaster_user_id", "from_broadcaster_user_id", "user_id"] as const;

/**
 * The channel a notification belongs to: the one in its subscription
 * condition, which is the channel we subscribed for. Body fields are only a
 * fallback, and to_broadcaster_user_id there only counts for raids: on
 * channel.shoutout.create it is the channel being shouted out, and taking it
 * credited one streamer's shoutout to another streamer's overlays and log.
 */
export function extractReceivingBroadcasterId(
  eventType: string,
  condition: Record<string, unknown> | null | undefined,
  event: Record<string, unknown>,
): string | null {
  for (const key of CONDITION_KEYS) {
    const value = condition?.[key];
    if (typeof value === "string" && value) return value;
  }

  if (!event) return null;

  if (eventType === "channel.raid" && typeof event.to_broadcaster_user_id === "string" && event.to_broadcaster_user_id) {
    return event.to_broadcaster_user_id;
  }

  // Standard broadcaster_user_id
  if (typeof event.broadcaster_user_id === "string" && event.broadcaster_user_id) {
    return event.broadcaster_user_id;
  }

  // Check nested data array
  if (Array.isArray(event.data) && event.data.length > 0) {
    const d0 = event.data[0] as Record<string, unknown>;
    if (eventType === "channel.raid" && d0?.to_broadcaster_user_id) return d0.to_broadcaster_user_id as string;
    if (d0?.broadcaster_user_id) return d0.broadcaster_user_id as string;
  }

  // Fallback for user-scoped events (e.g. user.authorization.revoke) where
  // there is no broadcaster_user_id — the user_id IS their broadcaster ID
  if (typeof event.user_id === "string" && event.user_id) {
    return event.user_id;
  }

  return null;
}
