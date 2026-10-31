import { type Context, type Next } from "hono";
import {
  bodyMatchesMessageType,
  getTwitchHeader,
  isTimestampFresh,
  MAX_MESSAGE_AGE_MS,
  MESSAGE_TYPE_VERIFICATION,
  TWITCH_MESSAGE_ID,
  TWITCH_MESSAGE_TIMESTAMP,
  TWITCH_MESSAGE_SIGNATURE,
  TWITCH_MESSAGE_TYPE,
  verifySignature,
} from "../utils/twitch-eventsub"
import type { EventSubVerificationPayload, EventSubNotificationPayload, EventSubRevocationPayload } from "@repo/types";

/**
 * Message ids seen in the last MAX_MESSAGE_AGE_MS, mapped to when they expire.
 * Twitch may deliver the same message more than once and expects a 2xx for
 * duplicates without processing them again. In memory, so it only dedupes
 * within one rest-api instance; older messages fail the timestamp check.
 * Insertion order is expiry order, so pruning stops at the first live entry.
 */
const seenMessageIds = new Map<string, number>();

function pruneSeenMessageIds(now: number) {
  for (const [id, expiresAt] of seenMessageIds) {
    if (expiresAt > now) break;
    seenMessageIds.delete(id);
  }
}

/**
 * Twitch EventSub Webhook Verification Middleware
 *
 * Verifies that incoming requests are authentic Twitch EventSub webhooks
 * by validating required headers and verifying HMAC signatures.
 *
 * On success, attaches the parsed notification and message type to the context.
 * On failure, returns appropriate error responses.
 *
 * @see https://dev.twitch.tv/docs/eventsub/handling-webhook-events/
 */
export function twitchEventSubVerification() {
  return async (c: Context, next: Next) => {
    const headers = c.req.raw.headers;
    // Extract required headers (case-insensitive)
    const messageId = getTwitchHeader(headers, TWITCH_MESSAGE_ID);
    const timestamp = getTwitchHeader(headers, TWITCH_MESSAGE_TIMESTAMP);
    const signature = getTwitchHeader(headers, TWITCH_MESSAGE_SIGNATURE);
    const messageType = getTwitchHeader(headers, TWITCH_MESSAGE_TYPE);

    // Validate required headers
    if (!messageId || !timestamp || !signature || !messageType) {
      return c.json(
        {
          error: "Missing required headers",
          message: "Twitch EventSub webhook requires specific headers",
        },
        400
      );
    }

    // Get raw body for signature verification
    // Check if raw body was stored in context by raw body middleware, otherwise read from request
    let rawBody: string;
    const contextRawBody = c.get("rawBody");
    if (typeof contextRawBody === "string") {
      rawBody = contextRawBody;
    } else {
      // Clone request to avoid consuming the body
      const clonedRequest = c.req.raw.clone();
      rawBody = await clonedRequest.text();
    }

    // Verify signature before processing
    const isValid = verifySignature(messageId, timestamp, rawBody, signature);

    if (!isValid) {
      console.warn("Invalid Twitch EventSub signature", {
        messageId,
        timestamp,
      });
      return c.json(
        {
          error: "Invalid signature",
          message: "Request signature verification failed",
        },
        403
      );
    }

    // Reject stale or far-future messages so a captured delivery can't be
    // replayed once its id has left the dedupe window
    if (!isTimestampFresh(timestamp)) {
      console.warn("Stale Twitch EventSub message", { messageId, timestamp });
      return c.json(
        {
          error: "Stale message",
          message: "Message timestamp is outside the allowed window",
        },
        403
      );
    }

    // Parse the notification body
    let notification: EventSubVerificationPayload | EventSubNotificationPayload | EventSubRevocationPayload;
    try {
      notification = JSON.parse(rawBody);
    } catch (error) {
      return c.json(
        {
          error: "Invalid JSON",
          message: "Failed to parse notification body",
        },
        400
      );
    }

    if (!bodyMatchesMessageType(messageType, notification)) {
      console.warn("Twitch EventSub message type does not match body", {
        messageId,
        messageType,
      });
      return c.json(
        {
          error: "Invalid message type",
          message: "Message type does not match the notification body",
        },
        400
      );
    }

    // Verification is left out: answering it twice is harmless, and a
    // duplicate must still get the challenge back or the subscription fails
    const dedupe = messageType !== MESSAGE_TYPE_VERIFICATION;
    if (dedupe) {
      const now = Date.now();
      pruneSeenMessageIds(now);
      if (seenMessageIds.has(messageId)) {
        return c.body(null, 204);
      }
      seenMessageIds.set(messageId, now + MAX_MESSAGE_AGE_MS);
    }

    // Attach verified notification and message type to context
    c.set("twitchNotification", notification);
    c.set("twitchMessageType", messageType);

    // Twitch retries a failed delivery with the same message id, so forget
    // the id when the handler failed and let the retry through
    try {
      await next();
    } catch (error) {
      if (dedupe) seenMessageIds.delete(messageId);
      throw error;
    }
    if (dedupe && (c.error || c.res.status >= 500)) {
      seenMessageIds.delete(messageId);
    }
  };
}
