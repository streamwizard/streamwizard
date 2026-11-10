import type { z } from "zod";
import { autoSwitcherConfigSchema } from "@repo/schemas/auto-switcher/auto-switcher";
import { IngestStatsPayloadSchema, type IngestStatsPayload } from "@repo/schemas/streamwizard-events";
import { consumerMessageSchema, ingestSessionEndedPayloadSchema, type IngestSessionEndedPayload } from "@repo/schemas/ws-server";
import { trackAutoSwitcherEvent } from "@repo/metrics";
import { reportError } from "@repo/sentry";
import { createReportThrottle, errorFingerprint } from "@repo/sentry/throttle";
import { ServiceSocket, type AuthHeaderProvider } from "@repo/ws-client/service-socket";


/** The one field of a config push the store reads: which row to re-read. */
const configPushSchema = autoSwitcherConfigSchema.pick({ user_id: true });
export type ConfigPush = z.infer<typeof configPushSchema>;

export interface StatsFeedHandlers {
  onIngestStats: (userId: string, payload: IngestStatsPayload) => void;
  onConfigPush: (userId: string, payload: ConfigPush) => void;
  onSessionEnded?: (userId: string, payload: IngestSessionEndedPayload) => void;
}

/** A consumer frame, parsed. What each handler gets is parsed too, so nothing
 *  that drives a scene switch is a cast. */
export type ConsumerEvent =
  | { type: "streamwizard.ingest_stats"; userId: string; payload: IngestStatsPayload }
  | { type: "streamwizard.auto_switcher_config"; userId: string; payload: ConfigPush }
  | { type: "streamwizard.ingest_session_ended"; userId: string; payload: IngestSessionEndedPayload };

export type ParsedConsumerFrame = { ok: true; event: ConsumerEvent | null } | { ok: false; reason: string };

/**
 * Parses one frame from ws-server's consumer feed. `event: null` is a valid
 * frame of a type this service doesn't handle; `ok: false` is a malformed one
 * (the reason is a short label, never the frame).
 */
// Stats arrive about once a second per live user, so a handler that breaks on
// one message breaks on every one after it: report each reason once an hour.
const allowReport = createReportThrottle({ intervalMs: 60 * 60_000 });

export function parseConsumerFrame(raw: string): ParsedConsumerFrame {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
  const envelope = consumerMessageSchema.safeParse(json);
  if (!envelope.success) return { ok: false, reason: "invalid_envelope" };
  const { userId, type, payload } = envelope.data;

  switch (type) {
    case "streamwizard.ingest_stats": {
      const parsed = IngestStatsPayloadSchema.safeParse(payload);
      return parsed.success ? { ok: true, event: { type, userId, payload: parsed.data } } : { ok: false, reason: type };
    }
    case "streamwizard.auto_switcher_config": {
      const parsed = configPushSchema.safeParse(payload);
      return parsed.success ? { ok: true, event: { type, userId, payload: parsed.data } } : { ok: false, reason: type };
    }
    case "streamwizard.ingest_session_ended": {
      const parsed = ingestSessionEndedPayloadSchema.safeParse(payload);
      return parsed.success ? { ok: true, event: { type, userId, payload: parsed.data } } : { ok: false, reason: type };
    }
    default:
      return { ok: true, event: null };
  }
}

export type { AuthHeaderProvider };

// Consumer-role client on ws-server: receives every user's ingest stats and
// config pushes, server-to-server. Reconnects through ServiceSocket.
export class StatsFeed {
  private socket: ServiceSocket;
  /** Malformed-frame reasons already logged, so a bad producer shows up once. */
  private warned = new Set<string>();

  constructor(
    url: string,
    authHeader: AuthHeaderProvider,
    private handlers: StatsFeedHandlers,
  ) {
    const types = ["streamwizard.ingest_stats", "streamwizard.auto_switcher_config", "streamwizard.ingest_session_ended"].join(",");
    this.socket = new ServiceSocket({
      url,
      query: { role: "consumer", types },
      authHeader,
      name: "stats-feed",
      noCredentialMessage: "no ws-server credential (WS_SERVICE_SIGNING_JWK); stats feed is off",
      onMessage: (data) => this.handleMessage(data),
      onReconnect: () => trackAutoSwitcherEvent("feed_reconnect"),
    });
  }

  connect(): void {
    this.socket.connect();
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  private handleMessage(data: unknown): void {
    const frame = parseConsumerFrame(String(data));
    if (!frame.ok) {
      if (!this.warned.has(frame.reason)) {
        this.warned.add(frame.reason);
        console.warn(`[stats-feed] dropped a malformed frame (${frame.reason})`);
      }
      return;
    }
    const ev = frame.event;
    if (!ev) return;
    // One bad message must not reach the process handler, which exits.
    try {
      switch (ev.type) {
        case "streamwizard.ingest_stats":
          this.handlers.onIngestStats(ev.userId, ev.payload);
          break;
        case "streamwizard.auto_switcher_config":
          this.handlers.onConfigPush(ev.userId, ev.payload);
          break;
        case "streamwizard.ingest_session_ended":
          this.handlers.onSessionEnded?.(ev.userId, ev.payload);
          break;
      }
    } catch (err) {
      if (allowReport(`${ev.type} ${errorFingerprint(err)}`)) {
        reportError(err, "stats-feed: message", { userId: ev.userId, type: ev.type });
      }
    }
  }
}
