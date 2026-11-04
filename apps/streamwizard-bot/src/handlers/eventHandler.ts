import { TwitchApi } from "@repo/twitch-api";
import { reportError } from "@repo/sentry";
import { createReportThrottle, errorFingerprint } from "@repo/sentry/throttle";
import { extractReceivingBroadcasterId } from "@repo/twitch-eventsub/receiving-broadcaster";
import type { EventSubSubscriptionType, WebSocketNotificationMessage } from "@repo/types";
import { z } from "zod";
import { registerTwitchHandlers } from "./twitch";
import { streamEventsLogger } from "@repo/logger";
import { broadcastOverlayEvent } from "../functions/broadcastOverlayEvent";
import { recordStreamLabels } from "../functions/recordStreamLabels";
import { trackEventSubReceived } from "@repo/metrics";

/**
 * Context passed to all event handlers in smp-bridge
 */
export interface HandlerContext {
  twitchApi: TwitchApi;
}

/**
 * Handler function signatures
 */
type TwitchHandler<TData = unknown> = (data: TData, context: HandlerContext) => Promise<void>;

/**
 * Internal handler wrapper
 */
type InternalHandler = (data: unknown, context: HandlerContext, broadcasterId: string) => Promise<void>;

// Handlers and the event log run once per notification, so a broken one fails
// on every event. Report the first failure, then once an hour per type and
// error. A payload that stops matching its schema stays broken until a
// deploy: once per type.
const allowFailureReport = createReportThrottle({ intervalMs: 60 * 60_000 });
const allowSchemaReport = createReportThrottle({ intervalMs: Number.POSITIVE_INFINITY });

/**
 * Handler Registry for smp-bridge supporting both Twitch and Minecraft events
 */
export class HandlerRegistry {
  private twitchHandlers = new Map<string, InternalHandler>();

  constructor() {
    registerTwitchHandlers(this);
  }

  // ============================================================================
  // Twitch Handlers
  // ============================================================================

  /**
   * Register a handler for a Twitch EventSub event type
   */
  registerTwitchHandler<TData = unknown>(
    eventType: EventSubSubscriptionType,
    handler: TwitchHandler<TData>,
    schema?: z.ZodType<TData>,
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
        if (allowFailureReport(`${eventType} ${errorFingerprint(error)}`)) {
          reportError(error, "eventsub: handler", { type: eventType, broadcasterId });
        }
      }
    });
  }

  /**
   * Process Twitch EventSub events
   */
  async processTwitchEvent(
    eventType: EventSubSubscriptionType,
    data: WebSocketNotificationMessage,
  ): Promise<void> {
    const handler = this.twitchHandlers.get(eventType);
    trackEventSubReceived("streamwizard-bot", eventType, !!handler, "websocket");

    const broadcasterId = extractReceivingBroadcasterId(
      eventType,
      data.payload.subscription?.condition as Record<string, unknown> | undefined,
      data.payload.event,
    );

    if (!broadcasterId) {
      console.warn(`[eventsub] no broadcaster id in ${eventType} event, skipped`);
      return;
    }

    if (eventType !== "channel.chat.message") {
      // Fire-and-forget so the overlay broadcast isn't held up by the insert.
      streamEventsLogger
        .logTwitchEvent({
          broadcaster_id: broadcasterId,
          event_type: eventType,
          event_data: data.payload.event,
          metadata: data.metadata,
        })
        .catch((error) => {
          if (allowFailureReport(`log ${eventType} ${errorFingerprint(error)}`)) {
            reportError(error, "eventsub: log event", { type: eventType, broadcasterId });
          }
        });

      // Latest follower/sub/cheer/... for the overlay labels, live or not.
      // Not awaited either: it catches and reports its own errors.
      void recordStreamLabels(broadcasterId, eventType, data.payload.event);
    }

    // Caught here so a failed broadcast still lets the bot handler run.
    await broadcastOverlayEvent(broadcasterId, eventType, data.payload.event).catch((error) => {
      if (allowFailureReport(`overlay ${eventType} ${errorFingerprint(error)}`)) {
        reportError(error, "eventsub: overlay broadcast", { type: eventType, broadcasterId });
      }
    });
    const twitchApi = new TwitchApi(broadcasterId);

    const context: HandlerContext = {
      twitchApi,
    };

    // Overlay-only event types have no bot handler; trackEventSubReceived
    // above already records that.
    if (!handler) return;

    await handler(data.payload.event, context, broadcasterId);
  }
}

export const handlers = new HandlerRegistry();
