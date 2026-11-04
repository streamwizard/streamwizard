import type { ServerWebSocket } from "bun";
import type { ConnectionData } from "@/types/connections";

export interface RoomData {
  subscribers: Set<ServerWebSocket<ConnectionData>>;
}

export const rooms = new Map<string, RoomData>();

export function shouldReceive(ws: ServerWebSocket<ConnectionData>, eventType: string): boolean {
  const ch = ws.data.channels;
  return ch.size === 0 || ch.has(eventType);
}

export function broadcastToRoom(room: RoomData, type: string, payload: unknown): void {
  const msg = JSON.stringify({ type, payload });
  for (const sub of room.subscribers) {
    if (shouldReceive(sub, type)) sub.send(msg);
  }
}
