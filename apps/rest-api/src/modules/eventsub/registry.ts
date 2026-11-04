import type { EventSubNotificationPayload, EventSubSubscriptionType } from "@repo/types";
import { z } from "zod";
import { TwitchApi } from "@repo/twitch-api";
import { reportError } from "@repo/sentry";
import { createReportThrottle, errorFingerprint } from "@repo/sentry/throttle";
import { extractReceivingBroadcasterId } from "@repo/twitch-eventsub/receiving-broadcaster";
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
