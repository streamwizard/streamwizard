import { supabase } from "@repo/supabase";
import { insertIrlGeoTrack } from "@repo/supabase/queries/irl";
import type { BotOutboundMessage, PublisherMessage } from "@repo/types";
import { trackWsConnection, trackWsMessage, trackWsMessageDrop, trackWsRoomEvent } from "@repo/metrics";
import { rooms, broadcastToRoom } from "../rooms";
import { monitors, broadcastToMonitors, broadcastNodeBandwidth, broadcastSnapshot, addBotSocket, removeBotSocket } from "../monitor";
import { addConsumer, removeConsumer } from "../consumers";
import { routeBotBroadcast } from "../bot-router";
import { updateNodeBandwidth } from "../ingest-nodes";
import type { ConnectionData, ServerWebSocket } from "../types";

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

    if (role === "publisher") {
      const room = rooms.get(userId);
      if (room) {
        if (room.publisher) trackWsRoomEvent("publisher_replaced");
        else trackWsRoomEvent("publisher_joined");
        room.publisher = ws;
      }
      broadcastToMonitors({
        ts: Date.now(),
        kind: "connect",
        direction: "system",
        role: "publisher",
        roomId: userId,
        meta: { subscriberCount: rooms.get(userId)?.subscribers.size ?? 0, hasPublisher: true, sessionId: ws.data.session_id },
      });
    } else if (role === "bot") {
      addBotSocket(ws);
      console.log(`[bot] connected source=${ws.data.source ?? "unknown"}`);
      broadcastToMonitors({ ts: Date.now(), kind: "connect", direction: "system", role: "bot", roomId: "_bot", source: ws.data.source });
    } else if (role === "consumer") {
      addConsumer(ws);
      console.log(`[consumer] connected source=${ws.data.source ?? "unknown"} types=${[...(ws.data.consumerTypes ?? [])].join(",") || "*"}`);
      broadcastToMonitors({ ts: Date.now(), kind: "connect", direction: "system", role: "bot", roomId: "_consumer", source: ws.data.source });
    } else {
      const room = rooms.get(userId);
      if (room) {
        room.subscribers.add(ws);
      } else {
        rooms.set(userId, {
          publisher: null,
          subscribers: new Set([ws]),
          session_id: "",
          stream_id: null,
        });
        trackWsRoomEvent("created");
        broadcastToMonitors({ ts: Date.now(), kind: "room", direction: "system", role: "subscriber", roomId: userId, eventType: "room_created" });
      }
      broadcastToMonitors({
        ts: Date.now(),
        kind: "connect",
        direction: "system",
        role: "subscriber",
        roomId: userId,
        meta: { subscriberCount: rooms.get(userId)?.subscribers.size ?? 0, hasPublisher: rooms.get(userId)?.publisher !== null },
      });
      console.log(`[subscriber] connected userId=${userId} channels=${[...ws.data.channels].join(",") || "*"}`);
    }
  },

  message(ws: ServerWebSocket<ConnectionData>, raw: string | Buffer): void {
    const { role, userId, session_id } = ws.data;

    // Monitors and consumers are receive-only.
    if (role === "monitor" || role === "consumer") return;

    const rawStr = typeof raw === "string" ? raw : raw.toString();

    // --- Bot: node metrics or fan-out to a target user's room ---
    if (role === "bot") {
      let msg: BotOutboundMessage;
      try {
        msg = JSON.parse(rawStr) as BotOutboundMessage;
      } catch {
        console.warn("[bot] malformed message");
        trackWsMessageDrop("bot", "malformed_json");
        return;
      }

      // Node-scoped metrics: never room-routed — fold into the per-node
      // bandwidth state (feeds the 5s snapshot) and forward live to monitors.
      // (`kind` only exists on NodeMetricsMessage, so `in` alone narrows.)
      if ("kind" in msg) {
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
      return;
    }

    if (role !== "publisher") return;

    let msg: PublisherMessage;
    try {
      msg = JSON.parse(rawStr) as PublisherMessage;
    } catch {
      console.warn(`[publisher] malformed message from userId=${userId}`);
      trackWsMessageDrop("publisher", "malformed_json");
      return;
    }
    trackWsMessage("publisher", msg.type ?? "unknown");

    const room = rooms.get(userId);
    if (!room) {
      trackWsMessageDrop("publisher", "room_not_found");
      return;
    }

    if (msg.type === "geo") {
      const geo = msg.payload;
      broadcastToRoom(room, "streamwizard.geo", { status: "connected", payload: geo });
      broadcastToMonitors({
        ts: Date.now(),
        kind: "message",
        direction: "inbound",
        role: "publisher",
        roomId: userId,
        eventType: "streamwizard.geo",
        meta: { subscriberCount: room.subscribers.size },
      });

      if (session_id) {
        insertIrlGeoTrack(supabase, {
          user_id: userId,
          session_id,
          stream_id: room.stream_id,
          latitude: geo.latitude,
          longitude: geo.longitude,
          altitude: geo.altitude,
          speed: geo.speed,
          heading: geo.heading,
          accuracy: geo.accuracy,
          recorded_at: new Date(geo.timestamp).toISOString(),
        }).then(({ error }) => {
          if (error) console.error("[geo-insert]", (error as { message: string }).message);
        });
      }
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

    if (role === "bot") {
      removeBotSocket(ws);
      console.log(`[bot] disconnected source=${ws.data.source ?? "unknown"}`);
      broadcastToMonitors({ ts: Date.now(), kind: "disconnect", direction: "system", role: "bot", roomId: "_bot", source: ws.data.source, meta: { durationMs } });
      return;
    }

    if (role === "consumer") {
      removeConsumer(ws);
      console.log(`[consumer] disconnected source=${ws.data.source ?? "unknown"}`);
      broadcastToMonitors({ ts: Date.now(), kind: "disconnect", direction: "system", role: "bot", roomId: "_consumer", source: ws.data.source, meta: { durationMs } });
      return;
    }

    if (role === "publisher") {
      const room = rooms.get(userId);
      if (room) {
        broadcastToRoom(room, "streamwizard.geo", { status: "offline" });
        room.publisher = null;
        trackWsRoomEvent("publisher_left");
        broadcastToMonitors({
          ts: Date.now(),
          kind: "disconnect",
          direction: "system",
          role: "publisher",
          roomId: userId,
          meta: { durationMs, subscriberCount: room.subscribers.size, hasPublisher: false },
        });
        if (room.subscribers.size === 0) {
          rooms.delete(userId);
          trackWsRoomEvent("deleted");
          broadcastToMonitors({ ts: Date.now(), kind: "room", direction: "system", role: "publisher", roomId: userId, eventType: "room_deleted" });
        }
        console.log(`[publisher] disconnected userId=${userId}`);
      }
    } else {
      const room = rooms.get(userId);
      if (room) {
        room.subscribers.delete(ws);
        broadcastToMonitors({
          ts: Date.now(),
          kind: "disconnect",
          direction: "system",
          role: "subscriber",
          roomId: userId,
          meta: { durationMs, subscriberCount: room.subscribers.size, hasPublisher: room.publisher !== null },
        });
        if (!room.publisher && room.subscribers.size === 0) {
          rooms.delete(userId);
          trackWsRoomEvent("deleted");
          broadcastToMonitors({ ts: Date.now(), kind: "room", direction: "system", role: "subscriber", roomId: userId, eventType: "room_deleted" });
        }
      }
      console.log(`[subscriber] disconnected userId=${userId}`);
    }
  },
};
