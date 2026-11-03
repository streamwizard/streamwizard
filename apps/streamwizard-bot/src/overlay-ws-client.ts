import type { BotBroadcastMessage } from "@repo/types";

const MAX_DELAY_MS = 30_000;

class OverlayWsClient {
  private ws: WebSocket | null = null;
  private url = "";
  private authHeader: () => Promise<string | null> = async () => null;
  private delay = 1000;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopping = false;

  /** `authHeader` runs on every (re)connect: a fresh service token, or
   *  null when this service has no signing key. */
  connect(url: string, authHeader: () => Promise<string | null>): void {
    this.url = url;
    this.authHeader = authHeader;
    this.stopping = false;
    void this.dial();
  }

  send(message: BotBroadcastMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    this.stopping = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.ws?.close();
  }

  private retry(): void {
    if (this.stopping) return;
    console.log(`[overlay-ws-client] disconnected — retrying in ${this.delay}ms`);
    this.retryTimer = setTimeout(() => void this.dial(), this.delay);
    this.delay = Math.min(this.delay * 2, MAX_DELAY_MS);
  }

  private async dial(): Promise<void> {
    let authorization: string | null;
    try {
      authorization = await this.authHeader();
    } catch (err) {
      console.error("[overlay-ws-client] could not sign a ws-server token", err);
      return this.retry();
    }
    if (!authorization) {
      console.error("[overlay-ws-client] no ws-server credential; overlay pushes are off");
      return;
    }
    if (this.stopping) return;
    // `source` labels this connection in ws-server's monitor view — several
    // bots connect at once (this one plus each ingest node's control plane).
    const ws = new WebSocket(`${this.url}/ws?role=bot`, {
      // @ts-expect-error Bun WebSocket supports headers in options
      headers: { Authorization: authorization },
    });
    this.ws = ws;

    ws.onopen = () => {
      console.log("[overlay-ws-client] connected");
      this.delay = 1000;
    };

    ws.onclose = () => this.retry();

    ws.onerror = () => {
      ws.close();
    };
  }
}

export const overlayWsClient = new OverlayWsClient();
