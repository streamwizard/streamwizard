import { supabase } from "@repo/supabase";
import { insertIrlGeoTrack } from "@repo/supabase/queries/irl";
import type { BotBroadcastMessage, PublisherMessage } from "@repo/types";
import { trackWsConnection, trackWsMessage } from "@repo/metrics";
import { rooms, broadcastToRoom } from "../rooms";
import type { ConnectionData, ServerWebSocket } from "../types";

export const websocketHandlers = {
  open(ws: ServerWebSocket<ConnectionData>): void {
    const { role, userId } = ws.data;
    trackWsConnection(role, "open");

    if (role === "publisher") {
      const room = rooms.get(userId);
      if (room) room.publisher = ws;
    } else if (role === "bot") {
      console.log("[bot] connected");
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
      }
      console.log(`[subscriber] connected userId=${userId} channels=${[...ws.data.channels].join(",") || "*"}`);
    }
  },

  message(ws: ServerWebSocket<ConnectionData>, raw: string | Buffer): void {
    const { role, userId, session_id } = ws.data;
    const rawStr = typeof raw === "string" ? raw : raw.toString();

    // --- Bot: fan-out to a target user's room ---
    if (role === "bot") {
      let msg: BotBroadcastMessage;
      try {
        msg = JSON.parse(rawStr) as BotBroadcastMessage;
      } catch {
        console.warn("[bot] malformed message");
        return;
      }
      trackWsMessage("bot", msg.type ?? "unknown");
      const room = rooms.get(msg.userId);
      if (!room) return;
      broadcastToRoom(room, msg.type, msg.payload);
      return;
    }

    if (role !== "publisher") return;

    let msg: PublisherMessage;
    try {
      msg = JSON.parse(rawStr) as PublisherMessage;
    } catch {
      console.warn(`[publisher] malformed message from userId=${userId}`);
      return;
    }
    trackWsMessage("publisher", msg.type ?? "unknown");

    const room = rooms.get(userId);
    if (!room) return;

    if (msg.type === "geo") {
      const geo = msg.payload;
      broadcastToRoom(room, "streamwizard.geo", { status: "connected", payload: geo });

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
    const { role, userId } = ws.data;
    trackWsConnection(role, "close");

    if (role === "bot") {
      console.log("[bot] disconnected");
      return;
    }

    if (role === "publisher") {
      const room = rooms.get(userId);
      if (room) {
        broadcastToRoom(room, "streamwizard.geo", { status: "offline" });
        room.publisher = null;
        if (room.subscribers.size === 0) {
          rooms.delete(userId);
        }
        console.log(`[publisher] disconnected userId=${userId}`);
      }
    } else {
      const room = rooms.get(userId);
      if (room) {
        room.subscribers.delete(ws);
        if (!room.publisher && room.subscribers.size === 0) {
          rooms.delete(userId);
        }
      }
      console.log(`[subscriber] disconnected userId=${userId}`);
    }
  },
};
