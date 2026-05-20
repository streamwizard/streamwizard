// Next.js replaces NEXT_PUBLIC_* at build time; declare process so tsc is happy in this library package.
declare const process: { env: Record<string, string | undefined> };

export type WsEventListener = (msg: unknown) => void;

interface RoomState {
  ws: WebSocket | null;
  listeners: Set<WsEventListener>;
  retryTimer: ReturnType<typeof setTimeout> | null;
  retryDelay: number;
}

const rooms = new Map<string, RoomState>();

function broadcast(room: RoomState, msg: unknown) {
  for (const listener of room.listeners) {
    listener(msg);
  }
}

function connect(subscriberToken: string, wsUrl: string, room: RoomState) {
  const ws = new WebSocket(`${wsUrl}/ws?role=subscriber&token=${encodeURIComponent(subscriberToken)}`);
  room.ws = ws;

  ws.onopen = () => {
    room.retryDelay = 1000;
    broadcast(room, { type: "ws:open" });
  };

  ws.onmessage = (event) => {
    try {
      broadcast(room, JSON.parse(event.data as string));
    } catch {
      // ignore malformed messages
    }
  };

  ws.onclose = () => {
    if (!rooms.has(subscriberToken)) return; // already cleaned up
    room.ws = null;
    broadcast(room, { type: "ws:close" });
    const delay = Math.min(room.retryDelay, 30000);
    room.retryDelay = Math.min(delay * 2, 30000);
    room.retryTimer = setTimeout(() => connect(subscriberToken, wsUrl, room), delay);
  };

  ws.onerror = () => ws.close();
}

export function subscribeToWsRoom(
  subscriberToken: string,
  wsUrl: string,
  listener: WsEventListener
): () => void {
  let room = rooms.get(subscriberToken);
  if (!room) {
    room = { ws: null, listeners: new Set(), retryTimer: null, retryDelay: 1000 };
    rooms.set(subscriberToken, room);
    connect(subscriberToken, wsUrl, room);
  }
  room.listeners.add(listener);
  return () => {
    const r = rooms.get(subscriberToken);
    if (!r) return;
    r.listeners.delete(listener);
    if (r.listeners.size === 0) {
      if (r.retryTimer) clearTimeout(r.retryTimer);
      r.ws?.close();
      rooms.delete(subscriberToken);
    }
  };
}
