/** Builds the Authorization header for each (re)connect: a fresh service
 *  token (@repo/service-token), or null when this service has no key. */
export type AuthHeaderProvider = () => Promise<string | null>;

export interface ServiceSocketOptions {
  /** ws-server base URL; the socket dials `${url}/ws?<query>`. */
  url: string;
  /** Query parameters, in order (`role`, and `types` for consumers). Values are URI-encoded. */
  query: Record<string, string>;
  authHeader: AuthHeaderProvider;
  /** Log prefix, e.g. "stats-feed" logs as "[stats-feed] ...". */
  name: string;
  /** Logged (after the prefix) when `authHeader` returns null; the socket then stays off. */
  noCredentialMessage: string;
  /** Raw `event.data` of each incoming message. */
  onMessage?: (data: unknown) => void;
  /** Runs each time a reconnect is scheduled, before the delay starts. */
  onReconnect?: () => void;
  /** Opens the socket. Defaults to Bun's WebSocket with the header; tests pass a fake. */
  createSocket?: (url: string, headers: Record<string, string>) => WebSocket;
}

const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

const bunSocket = (url: string, headers: Record<string, string>): WebSocket =>
  // @ts-expect-error Bun WebSocket supports headers in options
  new WebSocket(url, { headers });

/**
 * A server-to-server connection to ws-server that signs a fresh service token
 * on every dial and reconnects with exponential backoff (1 s doubling to
 * 30 s, reset once a connection opens) until `disconnect()`. A signing
 * failure retries; a missing credential logs once and stays off.
 */
export class ServiceSocket {
  private ws: WebSocket | null = null;
  private delay = INITIAL_DELAY_MS;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopping = false;

  constructor(private readonly options: ServiceSocketOptions) {}

  connect(): void {
    this.stopping = false;
    void this.dial();
  }

  disconnect(): void {
    this.stopping = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.ws?.close();
  }

  /** Sends `message` as JSON when connected; otherwise drops it. Returns whether it was sent. */
  send(message: unknown): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(message));
    return true;
  }

  private retry(): void {
    if (this.stopping) return;
    this.options.onReconnect?.();
    console.log(`[${this.options.name}] disconnected — retrying in ${this.delay}ms`);
    this.retryTimer = setTimeout(() => void this.dial(), this.delay);
    this.delay = Math.min(this.delay * 2, MAX_DELAY_MS);
  }

  private async dial(): Promise<void> {
    const { name, url, query } = this.options;
    let authorization: string | null;
    try {
      authorization = await this.options.authHeader();
    } catch (err) {
      console.error(`[${name}] could not sign a ws-server token`, err);
      return this.retry();
    }
    if (!authorization) {
      console.error(`[${name}] ${this.options.noCredentialMessage}`);
      return;
    }
    if (this.stopping) return;
    const search = Object.entries(query)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");
    const ws = (this.options.createSocket ?? bunSocket)(`${url}/ws?${search}`, { Authorization: authorization });
    this.ws = ws;

    ws.onopen = () => {
      console.log(`[${name}] connected`);
      this.delay = INITIAL_DELAY_MS;
    };

    if (this.options.onMessage) {
      const onMessage = this.options.onMessage;
      ws.onmessage = (event) => onMessage(event.data);
    }

    ws.onclose = () => this.retry();

    ws.onerror = () => {
      ws.close();
    };
  }
}
