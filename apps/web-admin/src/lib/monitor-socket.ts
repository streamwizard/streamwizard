import { mintMonitorTokenAction } from "@/actions/monitor";

// The ws-server monitor socket, shared by useMonitorWs (the ws pages) and
// useIngestLiveWs (/ingest). Each dial uses a fresh 60-second token from
// mintMonitorTokenAction; browsers can't set headers on a WebSocket, so the
// token rides in ?token=. Reconnects mint a new one.

const RECONNECT_DELAY_MS = 3000;

export type MonitorSocketStatus = "connecting" | "connected" | "disconnected";

async function monitorSocketUrl(wsUrl: string): Promise<string> {
  const { data, error } = await mintMonitorTokenAction();
  if (!data) throw new Error(error ?? "Couldn't authorize this request.");
  return `${wsUrl}/ws?role=monitor&token=${encodeURIComponent(data.token)}`;
}

/**
 * Keeps one monitor socket open (reconnecting every 3s after a drop or a
 * failed token mint) and hands each parsed frame to `onMessage`; malformed
 * frames are skipped. Returns the teardown for a useEffect.
 */
export function runMonitorSocket<T>(
  wsUrl: string,
  handlers: { onStatus: (status: MonitorSocketStatus) => void; onMessage: (msg: T) => void },
): () => void {
  let disposed = false;
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function retry() {
    handlers.onStatus("disconnected");
    reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
  }

  async function connect() {
    if (disposed) return;
    handlers.onStatus("connecting");

    let url: string;
    try {
      url = await monitorSocketUrl(wsUrl);
    } catch {
      if (!disposed) retry();
      return;
    }
    if (disposed) return;

    const socket = new WebSocket(url);
    ws = socket;
    socket.onopen = () => handlers.onStatus("connected");
    socket.onmessage = (e) => {
      try {
        handlers.onMessage(JSON.parse(e.data as string) as T);
      } catch {
        // ignore malformed frames
      }
    };
    socket.onclose = () => {
      ws = null;
      // Don't resurrect the socket after teardown — otherwise every unmount
      // or wsUrl change leaks a detached reconnect loop.
      if (!disposed) retry();
    };
    socket.onerror = () => socket.close();
  }

  void connect();

  return () => {
    disposed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) {
      // Drop handlers first so the pending close can't schedule a reconnect.
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      ws.close();
      ws = null;
    }
  };
}
