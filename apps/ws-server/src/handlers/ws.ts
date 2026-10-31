import { reportError } from "@repo/sentry";
import type { BotOutboundMessage } from "@repo/types";
import { trackWsConnection, trackWsMessage, trackWsMessageDrop, trackWsRoomEvent } from "@repo/metrics";
import { rooms } from "../rooms";
import { monitors, broadcastToMonitors, broadcastNodeBandwidth, broadcastSnapshot, addBotSocket, removeBotSocket } from "../monitor";
import { addConsumer, removeConsumer } from "../consumers";
import { trackCredentialSocket, untrackCredentialSocket } from "../revoke";
import { routeBotBroadcast } from "../bot-router";
import { updateNodeBandwidth } from "../ingest-nodes";
import type { ConnectionData, ServerWebSocket } from "../types";

function handleMessage(ws: ServerWebSocket<ConnectionData>, raw: string | Buffer): void {
  // Only bots send. Subscribers, monitors and consumers are receive-only.
  if (ws.data.role !== "bot") return;

  const rawStr = typeof raw === "string" ? raw : raw.toString();

  // Re-register on every message (Map.set by connId — effectively free).
  // The registry fills at open(), but a dev --hot reload resets module
  // state while sockets stay open: bandwidth state self-heals because
  // it's message-driven, and without this the bot would stay invisible
  // in the snapshot/topology until it reconnected.
  addBotSocket(ws);

  let msg: BotOutboundMessage;
  try {
    msg = JSON.parse(rawStr) as BotOutboundMessage;
  } catch {
    console.warn("[bot] malformed message");
    trackWsMessageDrop("bot", "malformed_json");
    return;
  }

  // Node-scoped messages: never room-routed. (`kind` only exists on
  // node-scoped messages, so `in` splits them from fan-out broadcasts.)
  if ("kind" in msg) {
    // Heartbeat echo — the bot client uses the pong to tell a healthy
    // link from a half-open TCP connection.
    if (msg.kind === "ping") {
      ws.send(JSON.stringify({ kind: "pong", ts: msg.ts }));
      return;
    }

    // Metrics fold into the per-node bandwidth state (feeds the 5s
    // snapshot) and forward live to monitors.
    const p = msg.payload;
    if (typeof p?.node_id !== "string" || p.node_id.length === 0 || typeof p.rx_bytes_per_sec !== "number" || typeof p.tx_bytes_per_sec !== "number") {
      trackWsMessageDrop("bot", "malformed_node_metrics");
      return;
    }
    trackWsMessage("bot", "node_metrics", ws.data.source);
    updateNodeBandwidth(p);
    broadcastNodeBandwidth({ ts: Date.now(), kind: "node_bandwidth", source: ws.data.source, payload: p });
    return;
  }

  // A broadcast without a target user can't be routed or mirrored
  // (maskRoomId needs a string) — treat it as malformed.
  if (typeof msg.userId !== "string" || msg.userId.length === 0) {
    trackWsMessageDrop("bot", "malformed_json");
    return;
  }

  routeBotBroadcast(msg, ws.data.source);
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

    trackWsConnection(role, "open", undefined, ws.data.source);
    trackCredentialSocket(ws);

    if (role === "bot") {
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

    trackWsConnection(role, "close", durationMs, ws.data.source);
    untrackCredentialSocket(ws);

    if (role === "bot") {
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
