import type { OverlayEventType } from "@repo/types";
import type { ConnectionData, RoomData, ServerWebSocket } from "./types";

export const rooms = new Map<string, RoomData>();

export function shouldReceive(ws: ServerWebSocket<ConnectionData>, eventType: OverlayEventType): boolean {
  const ch = ws.data.channels;
  return ch.size === 0 || ch.has(eventType);
}

export function broadcastToRoom(room: RoomData, type: OverlayEventType, payload: unknown): void {
  const msg = JSON.stringify({ type, payload });
  for (const sub of room.subscribers) {
    if (shouldReceive(sub, type)) sub.send(msg);
  }
}
