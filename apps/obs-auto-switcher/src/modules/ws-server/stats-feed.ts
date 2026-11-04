import type { z } from "zod";
import { autoSwitcherConfigSchema, IngestStatsPayloadSchema, type IngestStatsPayload } from "@repo/schemas";
import { consumerMessageSchema, ingestSessionEndedPayloadSchema, type IngestSessionEndedPayload } from "@repo/schemas/ws-server";
import { trackAutoSwitcherEvent } from "@repo/metrics";

const MAX_DELAY_MS = 30_000;

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

// Consumer-role client on ws-server: receives every user's ingest stats and
// config pushes, server-to-server (same reconnect shape as the bot clients —
// see apps/streamwizard-bot/src/overlay-ws-client.ts).
/** Builds the Authorization header for each (re)connect: a fresh service
 *  token (@repo/service-token), or null when this service has no key. */
export type AuthHeaderProvider = () => Promise<string | null>;

export class StatsFeed {
  private ws: WebSocket | null = null;
  private delay = 1000;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopping = false;
  /** Malformed-frame reasons already logged, so a bad producer shows up once. */
  private warned = new Set<string>();

  constructor(
    private url: string,
    private authHeader: AuthHeaderProvider,
    private handlers: StatsFeedHandlers,
  ) {}

  connect(): void {
    this.stopping = false;
    void this.dial();
  }

  disconnect(): void {
    this.stopping = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.ws?.close();
  }

  private retry(): void {
    if (this.stopping) return;
    trackAutoSwitcherEvent("feed_reconnect");
    console.log(`[stats-feed] disconnected — retrying in ${this.delay}ms`);
    this.retryTimer = setTimeout(() => void this.dial(), this.delay);
    this.delay = Math.min(this.delay * 2, MAX_DELAY_MS);
  }

  private async dial(): Promise<void> {
    let authorization: string | null;
    try {
      authorization = await this.authHeader();
    } catch (err) {
      console.error("[stats-feed] could not sign a ws-server token", err);
      return this.retry();
    }
    if (!authorization) {
      console.error("[stats-feed] no ws-server credential (WS_SERVICE_SIGNING_JWK); stats feed is off");
      return;
    }
    if (this.stopping) return;
    const types = ["streamwizard.ingest_stats", "streamwizard.auto_switcher_config", "streamwizard.ingest_session_ended"].join(",");
    const ws = new WebSocket(`${this.url}/ws?role=consumer&types=${encodeURIComponent(types)}`, {
      // @ts-expect-error Bun WebSocket supports headers in options
      headers: { Authorization: authorization },
    });
    this.ws = ws;

    ws.onopen = () => {
      console.log("[stats-feed] connected");
      this.delay = 1000;
    };

    ws.onmessage = (event) => {
      const frame = parseConsumerFrame(String(event.data));
      if (!frame.ok) {
        if (!this.warned.has(frame.reason)) {
          this.warned.add(frame.reason);
          console.warn(`[stats-feed] dropped a malformed frame (${frame.reason})`);
        }
        return;
      }
      const ev = frame.event;
      if (!ev) return;
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
    };

    ws.onclose = () => this.retry();

    ws.onerror = () => {
      ws.close();
    };
  }
}
