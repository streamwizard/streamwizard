import { supabase } from "@repo/supabase";
import { insertIrlGeoTrack } from "@repo/supabase/queries/irl";
import type { BotBroadcastMessage, PublisherMessage } from "@repo/types";
import { trackWsConnection, trackWsMessage, trackWsMessageDrop, trackWsRoomEvent } from "@repo/metrics";
import { rooms, broadcastToRoom } from "../rooms";
import { monitors, broadcastToMonitors, broadcastSnapshot, sanitizePayload, setBotSocket } from "../monitor";
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

    trackWsConnection(role, "open");

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
      setBotSocket(ws);
      console.log("[bot] connected");
      broadcastToMonitors({ ts: Date.now(), kind: "connect", direction: "system", role: "bot", roomId: "_bot" });
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

    if (role === "monitor") return;

    const rawStr = typeof raw === "string" ? raw : raw.toString();

    // --- Bot: fan-out to a target user's room ---
    if (role === "bot") {
      let msg: BotBroadcastMessage;
      try {
        msg = JSON.parse(rawStr) as BotBroadcastMessage;
      } catch {
        console.warn("[bot] malformed message");
        trackWsMessageDrop("bot", "malformed_json");
        return;
      }
      trackWsMessage("bot", msg.type ?? "unknown");
      const room = rooms.get(msg.userId);
      if (!room) {
        trackWsMessageDrop("bot", "room_not_found");
        return;
      }
      broadcastToRoom(room, msg.type, msg.payload);
      broadcastToMonitors({
        ts: Date.now(),
        kind: "message",
        direction: "inbound",
        role: "bot",
        roomId: msg.userId,
        eventType: msg.type,
        payload: sanitizePayload(msg.payload),
        meta: { subscriberCount: room.subscribers.size },
      });
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

    trackWsConnection(role, "close", durationMs);

    if (role === "bot") {
      setBotSocket(null);
      console.log("[bot] disconnected");
      broadcastToMonitors({ ts: Date.now(), kind: "disconnect", direction: "system", role: "bot", roomId: "_bot", meta: { durationMs } });
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
