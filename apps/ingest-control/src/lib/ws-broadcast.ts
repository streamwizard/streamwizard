import type { BotBroadcastMessage } from "@repo/types";
import { env } from "./env";

// Pushes live events into ws-server's room system as a "bot" client, the same
// mechanism the Discord bot uses to fan out overlay events. Mirrors
// apps/streamwizard-bot/src/overlay-ws-client.ts.

const MAX_DELAY_MS = 30_000;

class WsBroadcastClient {
  private ws: WebSocket | null = null;
  private delay = 1000;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopping = false;

  connect(): void {
    if (!env.WS_SERVER_URL) return;
    this.stopping = false;
    this.dial();
  }

  send(message: BotBroadcastMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private dial(): void {
    const ws = new WebSocket(`${env.WS_SERVER_URL}/ws?role=bot`, {
      // @ts-expect-error Bun WebSocket supports headers in options
      headers: { Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` },
    });
    this.ws = ws;

    ws.onopen = () => {
      console.log("[ws-broadcast] connected");
      this.delay = 1000;
    };

    ws.onclose = () => {
      if (this.stopping) return;
      console.log(`[ws-broadcast] disconnected — retrying in ${this.delay}ms`);
      this.retryTimer = setTimeout(() => this.dial(), this.delay);
      this.delay = Math.min(this.delay * 2, MAX_DELAY_MS);
    };

    ws.onerror = () => ws.close();
  }
}

export const wsBroadcastClient = new WsBroadcastClient();
