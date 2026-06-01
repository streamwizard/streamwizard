import type { ConnectionData, ServerWebSocket } from "../types";
import type { ConnectionSnapshot, MonitorEnvelope, MonitorSnapshot, RoomSnapshot } from "./types";
import { rooms } from "../rooms";

export const monitors = new Set<ServerWebSocket<ConnectionData>>();

let _botSocket: ServerWebSocket<ConnectionData> | null = null;
export function getBotSocket() { return _botSocket; }
export function setBotSocket(ws: ServerWebSocket<ConnectionData> | null) { _botSocket = ws; }

function maskRoomId(userId: string): string {
  if (userId.length <= 8) return userId.slice(0, 2) + "***";
  return userId.slice(0, 4) + "…" + userId.slice(-4);
}

export function broadcastToMonitors(envelope: MonitorEnvelope): void {
  if (monitors.size === 0) return;

  const masked: MonitorEnvelope = {
    ...envelope,
    roomId: maskRoomId(envelope.roomId),
  };

  const msg = JSON.stringify(masked);
  for (const ws of monitors) {
    ws.send(msg);
  }
}

export function buildRoomSnapshot(): MonitorSnapshot {
  const roomSnapshots: RoomSnapshot[] = [];
  let totalConnections = 0;

  for (const [userId, room] of rooms.entries()) {
    const subCount = room.subscribers.size;
    const hasPub = room.publisher !== null;
    totalConnections += subCount + (hasPub ? 1 : 0);

    const connections: ConnectionSnapshot[] = [];

    if (room.publisher) {
      const d = room.publisher.data;
      connections.push({
        connId: d.connId,
        role: "publisher",
        connectedAt: d.connectedAt,
        channels: [],
      });
    }

    for (const sub of room.subscribers) {
      const d = sub.data;
      connections.push({
        connId: d.connId,
        role: "subscriber",
        connectedAt: d.connectedAt,
        channels: Array.from(d.channels),
      });
    }

    roomSnapshots.push({
      roomId: maskRoomId(userId),
      hasPublisher: hasPub,
      subscriberCount: subCount,
      sessionId: room.session_id,
      streamId: room.stream_id,
      connections,
    });
  }

  return {
    ts: Date.now(),
    kind: "snapshot",
    rooms: roomSnapshots,
    totalConnections: totalConnections + (_botSocket ? 1 : 0),
    bot: {
      connected: _botSocket !== null,
      connId: _botSocket?.data.connId ?? null,
      connectedAt: _botSocket?.data.connectedAt ?? null,
    },
  };
}

export function broadcastSnapshot(): void {
  if (monitors.size === 0) return;

  const snapshot = buildRoomSnapshot();
  const msg = JSON.stringify(snapshot);
  for (const ws of monitors) {
    ws.send(msg);
  }
}
