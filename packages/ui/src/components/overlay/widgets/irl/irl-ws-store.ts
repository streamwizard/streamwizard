// Next.js replaces NEXT_PUBLIC_* at build time; declare process so tsc is happy in this library package.
declare const process: { env: Record<string, string | undefined> };

import type { GeoPayload, IrlSocketMessage } from "../../types";

export type IrlConnectionStatus = "connecting" | "connected" | "offline" | "disconnected";
export type IrlGeoListener = (geo: GeoPayload | null, status: IrlConnectionStatus) => void;

interface RoomState {
  geo: GeoPayload | null;
  status: IrlConnectionStatus;
  ws: WebSocket | null;
  listeners: Set<IrlGeoListener>;
  retryTimer: ReturnType<typeof setTimeout> | null;
  retryDelay: number;
}

const rooms = new Map<string, RoomState>();

function broadcast(room: RoomState) {
  for (const listener of room.listeners) {
    listener(room.geo, room.status);
  }
}

function connect(userId: string, wsUrl: string, room: RoomState) {
  room.status = "connecting";
  broadcast(room);

  const ws = new WebSocket(`${wsUrl}/ws?role=subscriber&userId=${encodeURIComponent(userId)}`);
  room.ws = ws;

  ws.onopen = () => {
    room.retryDelay = 1000;
    room.status = "connected";
    broadcast(room);
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string) as IrlSocketMessage;
      if (msg.type === "geo") {
        room.geo = msg.payload;
        room.status = "connected";
        broadcast(room);
      } else if (msg.type === "status" && msg.payload.status === "offline") {
        room.status = "offline";
        broadcast(room);
      }
    } catch {
      // ignore malformed messages
    }
  };

  ws.onclose = () => {
    if (!rooms.has(userId)) return; // already cleaned up
    room.ws = null;
    room.status = "disconnected";
    broadcast(room);
    const delay = Math.min(room.retryDelay, 30000);
    room.retryDelay = Math.min(delay * 2, 30000);
    room.retryTimer = setTimeout(() => connect(userId, wsUrl, room), delay);
  };

  ws.onerror = () => {
    ws.close();
  };
}

export function subscribeToIrlData(
  userId: string,
  wsUrl: string,
  listener: IrlGeoListener
): () => void {
  let room = rooms.get(userId);
  if (!room) {
    room = {
      geo: null,
      status: "connecting",
      ws: null,
      listeners: new Set(),
      retryTimer: null,
      retryDelay: 1000,
    };
    rooms.set(userId, room);
    connect(userId, wsUrl, room);
  }

  room.listeners.add(listener);
  // Immediately deliver current state
  listener(room.geo, room.status);

  return () => {
    const r = rooms.get(userId);
    if (!r) return;
    r.listeners.delete(listener);
    if (r.listeners.size === 0) {
      if (r.retryTimer) clearTimeout(r.retryTimer);
      r.ws?.close();
      rooms.delete(userId);
    }
  };
}
