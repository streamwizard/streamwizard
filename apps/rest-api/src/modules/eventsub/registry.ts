import type { EventSubNotificationPayload, EventSubSubscriptionType } from "@repo/types";
import { z } from "zod";
import { TwitchApi } from "@repo/twitch-api";
import { reportError } from "@repo/sentry";
import { createReportThrottle, errorFingerprint } from "@repo/sentry/throttle";
import { supabase } from "@repo/supabase";
import { getTwitchIntegrationByBroadcasterId } from "@repo/supabase/queries/user";
import { registerTwitchHandlers } from "@/modules/eventsub/register";

/**
 * Context passed to all Twitch event handlers in rest-api
 */
export interface RestApiHandlerContext {
  twitchApi: TwitchApi;
}

/**
 * Handler function signature
 */
type EventHandler<TData = unknown> = (
  data: TData,
  context: RestApiHandlerContext
) => Promise<void>;

/**
 * Internal handler wrapper
 */
type InternalHandler = (
  data: unknown,
  context: RestApiHandlerContext,
  broadcasterId: string
) => Promise<void>;

// Handlers run once per notification, so a broken one fails on every event.
// Report the first failure, then once an hour per type and error. A payload
// that stops matching its schema stays broken until a deploy: once per type.
const allowHandlerReport = createReportThrottle({ intervalMs: 60 * 60_000 });
const allowSchemaReport = createReportThrottle({ intervalMs: Number.POSITIVE_INFINITY });

/**
 * Handler Registry for rest-api Twitch EventSub events
 */
export class HandlerRegistry {
  private twitchHandlers = new Map<string, InternalHandler>();

  constructor() {
    registerTwitchHandlers(this);
  }

  /**
   * Register a handler for a Twitch EventSub event type
   */
  registerTwitchHandler<TData = unknown>(
    eventType: EventSubSubscriptionType,
    handler: EventHandler<TData>,
    schema?: z.ZodType<TData>
  ): void {
    this.twitchHandlers.set(eventType, async (data, context, broadcasterId) => {
      let parsedData = data as TData;
      if (schema) {
        const result = schema.safeParse(data);
        if (!result.success) {
          if (allowSchemaReport(eventType)) reportError(result.error, "eventsub: schema mismatch", { type: eventType, broadcasterId });
          return;
        }
        parsedData = result.data;
      }
      try {
        await handler(parsedData, context);
      } catch (error) {
        if (allowHandlerReport(`${eventType} ${errorFingerprint(error)}`)) {
          reportError(error, "eventsub: handler", { type: eventType, broadcasterId });
        }
      }
    });
  }

  /**
   * Process Twitch EventSub events with broadcaster validation
   */
  async processTwitchEvent(
    eventType: EventSubSubscriptionType,
    data: EventSubNotificationPayload,
    condition?: Record<string, unknown>
  ): Promise<void> {
    const broadcasterId = extractReceivingBroadcasterId(eventType, condition, data as unknown as Record<string, unknown>);

    if (!broadcasterId) {
      throw new Error(`No broadcaster id found in ${eventType} event`);
    }

    // Check if the broadcaster is known to the database
    const { data: broadcaster, error: broadcasterError } = await getTwitchIntegrationByBroadcasterId(supabase, broadcasterId);

    // PGRST116 is .single() finding no row: a channel we don't know.
    if (broadcasterError && broadcasterError.code !== "PGRST116") {
      if (allowHandlerReport(`lookup ${broadcasterError.code}`)) {
        reportError(broadcasterError, "eventsub: broadcaster lookup", { type: eventType, broadcasterId });
      }
      return;
    }
    if (!broadcaster) {
      console.warn(`[eventsub] ${eventType} for a broadcaster we don't know, skipped`);
      return;
    }

    const handler = this.twitchHandlers.get(eventType);
    if (!handler) {
      console.warn(`[eventsub] no handler for ${eventType}`);
      return;
    }

    const twitchApi = new TwitchApi(broadcasterId);
    const context: RestApiHandlerContext = { twitchApi };

    await handler(data, context, broadcasterId);
  }
}

export const handlers = new HandlerRegistry();

const CONDITION_KEYS = ["to_broadcaster_user_id", "broadcaster_user_id", "from_broadcaster_user_id", "user_id"] as const;

/**
 * The channel a notification belongs to: the one in its subscription
 * condition. Body fields are only a fallback, and to_broadcaster_user_id there
 * only counts for raids (on channel.shoutout.create it is the other channel).
 * Same rule as streamwizard-bot's copy.
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
