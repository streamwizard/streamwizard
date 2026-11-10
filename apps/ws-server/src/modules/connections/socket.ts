import { reportError } from "@repo/sentry";
import { trackWsConnection, trackWsRoomEvent } from "@repo/metrics";
import { rooms } from "@/modules/rooms/rooms";
import { monitors, broadcastToMonitors, broadcastSnapshot, addBotSocket, removeBotSocket } from "@/modules/monitor/broadcast";
import { addConsumer, removeConsumer } from "@/modules/consumers/consumers";
import { trackCredentialSocket, untrackCredentialSocket } from "@/modules/revoke/revoke";
import { handleBotMessage } from "@/modules/broadcast/socket";
import { handleIngestNodeMessage } from "@/modules/ingest/socket";
import type { ServerWebSocket } from "bun";
import type { ConnectionData } from "@/types/connections";

// Socket lifecycle for every role: register on open, hand each message to the
// module that owns the sender's role, clean up on close.

function handleMessage(ws: ServerWebSocket<ConnectionData>, raw: string | Buffer): void {
  if (ws.data.role === "ingest-node") {
    handleIngestNodeMessage(ws, typeof raw === "string" ? raw : raw.toString());
    return;
  }
  // Only bots and ingest nodes send. Subscribers, monitors and consumers are
  // receive-only.
  if (ws.data.role !== "bot") return;
  handleBotMessage(ws, typeof raw === "string" ? raw : raw.toString());
}

export const websocketHandlers = {
  open(ws: ServerWebSocket<ConnectionData>): void {
    const { role, userId } = ws.data;

    if (role === "monitor") {
      monitors.add(ws);
      broadcastSnapshot();
      console.log("[monitor] connected");
      return;
    }

    trackWsConnection(role === "ingest-node" ? "bot" : role, "open", undefined, ws.data.source);
    trackCredentialSocket(ws);

    if (role === "bot" || role === "ingest-node") {
      addBotSocket(ws);
      console.log(`[bot] connected source=${ws.data.source ?? "unknown"}`);
      broadcastToMonitors({ ts: Date.now(), kind: "connect", direction: "system", role: "bot", roomId: "_bot", source: ws.data.source });
    } else if (role === "consumer") {
      addConsumer(ws);
      console.log(`[consumer] connected source=${ws.data.source ?? "unknown"} types=${[...(ws.data.consumerTypes ?? [])].join(",") || "*"}`);
      broadcastToMonitors({ ts: Date.now(), kind: "connect", direction: "system", role: "consumer", roomId: "_consumer", source: ws.data.source });
    } else {
      const room = rooms.get(userId);
      if (room) {
        room.subscribers.add(ws);
      } else {
        rooms.set(userId, { subscribers: new Set([ws]) });
        trackWsRoomEvent("created");
        broadcastToMonitors({ ts: Date.now(), kind: "room", direction: "system", role: "subscriber", roomId: userId, eventType: "room_created" });
      }
      broadcastToMonitors({
        ts: Date.now(),
        kind: "connect",
        direction: "system",
        role: "subscriber",
        roomId: userId,
        meta: { subscriberCount: rooms.get(userId)?.subscribers.size ?? 0 },
      });
      console.log(`[subscriber] connected userId=${userId} channels=${[...ws.data.channels].join(",") || "*"}`);
    }
  },

  message(ws: ServerWebSocket<ConnectionData>, raw: string | Buffer): void {
    // A throw here would reach the process-wide uncaughtException handler,
    // which exits — one bad frame must never take the server down for
    // every other streamer.
    try {
      handleMessage(ws, raw);
    } catch (err) {
      reportError(err, "ws.message", { role: ws.data.role, userId: ws.data.userId });
    }
  },
  close(ws: ServerWebSocket<ConnectionData>): void {
    const { role, userId, connectedAt } = ws.data;
    const durationMs = Date.now() - connectedAt;

    if (role === "monitor") {
      monitors.delete(ws);
      console.log("[monitor] disconnected");
      return;
    }

    trackWsConnection(role === "ingest-node" ? "bot" : role, "close", durationMs, ws.data.source);
    untrackCredentialSocket(ws);

    if (role === "bot" || role === "ingest-node") {
      removeBotSocket(ws);
      console.log(`[bot] disconnected source=${ws.data.source ?? "unknown"}`);
      broadcastToMonitors({ ts: Date.now(), kind: "disconnect", direction: "system", role: "bot", roomId: "_bot", source: ws.data.source, meta: { durationMs } });
      return;
    }

    if (role === "consumer") {
      removeConsumer(ws);
      console.log(`[consumer] disconnected source=${ws.data.source ?? "unknown"}`);
      broadcastToMonitors({ ts: Date.now(), kind: "disconnect", direction: "system", role: "consumer", roomId: "_consumer", source: ws.data.source, meta: { durationMs } });
      return;
    }

    const room = rooms.get(userId);
    if (room) {
      room.subscribers.delete(ws);
      broadcastToMonitors({
        ts: Date.now(),
        kind: "disconnect",
        direction: "system",
        role: "subscriber",
        roomId: userId,
        meta: { durationMs, subscriberCount: room.subscribers.size },
      });
      if (room.subscribers.size === 0) {
        rooms.delete(userId);
        trackWsRoomEvent("deleted");
        broadcastToMonitors({ ts: Date.now(), kind: "room", direction: "system", role: "subscriber", roomId: userId, eventType: "room_deleted" });
      }
    }
    console.log(`[subscriber] disconnected userId=${userId}`);
  },
};
