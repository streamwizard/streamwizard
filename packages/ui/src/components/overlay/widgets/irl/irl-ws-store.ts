// Next.js replaces NEXT_PUBLIC_* at build time; declare process so tsc is happy in this library package.
declare const process: { env: Record<string, string | undefined> };

import type { GeoPayload } from "../../types";
import type { OverlaySocketMessage } from "@repo/types";

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

function connect(subscriberToken: string, wsUrl: string, room: RoomState) {
  room.status = "connecting";
  broadcast(room);

  const ws = new WebSocket(`${wsUrl}/ws?role=subscriber&token=${encodeURIComponent(subscriberToken)}`);
  room.ws = ws;

  ws.onopen = () => {
    room.retryDelay = 1000;
    room.status = "connected";
    broadcast(room);
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string) as OverlaySocketMessage;
      if (msg.type === "streamwizard.geo") {
        if (msg.status === "offline") {
          room.status = "offline";
        } else {
          room.geo = msg.payload;
          room.status = "connected";
        }
        broadcast(room);
      }
    } catch {
      // ignore malformed messages
    }
  };

  ws.onclose = () => {
    if (!rooms.has(subscriberToken)) return; // already cleaned up
    room.ws = null;
    room.status = "disconnected";
    broadcast(room);
    const delay = Math.min(room.retryDelay, 30000);
    room.retryDelay = Math.min(delay * 2, 30000);
    room.retryTimer = setTimeout(() => connect(subscriberToken, wsUrl, room), delay);
  };

  ws.onerror = () => {
    ws.close();
  };
}

export function subscribeToIrlData(
  subscriberToken: string,
  wsUrl: string,
  listener: IrlGeoListener
): () => void {
  let room = rooms.get(subscriberToken);
  if (!room) {
    room = {
      geo: null,
      status: "connecting",
      ws: null,
      listeners: new Set(),
      retryTimer: null,
      retryDelay: 1000,
    };
    rooms.set(subscriberToken, room);
    connect(subscriberToken, wsUrl, room);
  }

  room.listeners.add(listener);
  // Immediately deliver current state
  listener(room.geo, room.status);

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
