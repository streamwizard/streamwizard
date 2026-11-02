import type { IngestStatsPayload } from "@repo/types";
import { trackAutoSwitcherEvent } from "@repo/metrics";

const MAX_DELAY_MS = 30_000;

export interface ConsumerMessage {
  userId: string;
  type: string;
  payload: unknown;
  ts?: number;
}

export interface StatsFeedHandlers {
  onIngestStats: (userId: string, payload: IngestStatsPayload) => void;
  onConfigPush: (userId: string, payload: unknown) => void;
  onSessionEnded?: (userId: string, payload: unknown) => void;
}

// Consumer-role client on ws-server: receives every user's ingest stats and
// config pushes, server-to-server (same reconnect shape as the bot clients —
// see apps/streamwizard-bot/src/overlay-ws-client.ts).
/** Builds the Authorization header for each (re)connect: a fresh service
 *  token (@repo/service-token), or the legacy secret where there's no key. */
export type AuthHeaderProvider = () => Promise<string | null>;

export class StatsFeed {
  private ws: WebSocket | null = null;
  private delay = 1000;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopping = false;

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
      console.error("[stats-feed] no ws-server credential (WS_SERVICE_SIGNING_JWK or CONSUMER_SECRET); stats feed is off");
      return;
    }
    if (this.stopping) return;
    const types = ["streamwizard.ingest_stats", "streamwizard.auto_switcher_config", "streamwizard.ingest_session_ended"].join(",");
    const ws = new WebSocket(`${this.url}/ws?role=consumer&source=obs-auto-switcher&types=${encodeURIComponent(types)}`, {
      // @ts-expect-error Bun WebSocket supports headers in options
      headers: { Authorization: authorization },
    });
    this.ws = ws;

    ws.onopen = () => {
      console.log("[stats-feed] connected");
      this.delay = 1000;
    };

    ws.onmessage = (event) => {
      let msg: ConsumerMessage;
      try {
        msg = JSON.parse(String(event.data)) as ConsumerMessage;
      } catch {
        return;
      }
      if (typeof msg.userId !== "string" || typeof msg.type !== "string") return;

      switch (msg.type) {
        case "streamwizard.ingest_stats":
          this.handlers.onIngestStats(msg.userId, msg.payload as IngestStatsPayload);
          break;
        case "streamwizard.auto_switcher_config":
          this.handlers.onConfigPush(msg.userId, msg.payload);
          break;
        case "streamwizard.ingest_session_ended":
          this.handlers.onSessionEnded?.(msg.userId, msg.payload);
          break;
      }
    };

    ws.onclose = () => this.retry();

    ws.onerror = () => {
      ws.close();
    };
  }
}
