import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PORT = Number(process.env.PORT ?? 3009);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface GeoPayload {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  accuracy: number;
  timestamp: number;
}

interface RoomData {
  publisher: ServerWebSocket<ConnectionData> | null;
  subscribers: Set<ServerWebSocket<ConnectionData>>;
  session_id: string;
  stream_id: string | null;
}

interface ConnectionData {
  role: "publisher" | "subscriber";
  userId: string;
  session_id?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServerWebSocket<T> = import("bun").ServerWebSocket<T>;

const rooms = new Map<string, RoomData>();

async function findCurrentStreamId(userId: string): Promise<string | null> {
  try {
    const { data: integration } = await supabase
      .from("integrations_twitch")
      .select("twitch_user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!integration?.twitch_user_id) return null;

    const { data: status } = await supabase
      .from("broadcaster_live_status")
      .select("stream_id")
      .eq("broadcaster_id", integration.twitch_user_id)
      .eq("is_live", true)
      .maybeSingle();

    return status?.stream_id ?? null;
  } catch {
    return null;
  }
}

function insertGeoTrack(
  userId: string,
  sessionId: string,
  streamId: string | null,
  geo: GeoPayload
): void {
  // Fire-and-forget — never block the broadcast path
  supabase
    .from("irl_geo_track" as never)
    .insert({
      user_id: userId,
      session_id: sessionId,
      stream_id: streamId,
      latitude: geo.latitude,
      longitude: geo.longitude,
      altitude: geo.altitude,
      speed: geo.speed,
      heading: geo.heading,
      accuracy: geo.accuracy,
      recorded_at: new Date(geo.timestamp).toISOString(),
    } as never)
    .then(({ error }) => {
      if (error) console.error("[geo-insert]", error.message);
    });
}

const server = Bun.serve<ConnectionData>({
  port: PORT,

  async fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname !== "/ws") {
      return new Response("Not Found", { status: 404 });
    }

    const role = url.searchParams.get("role");
    const userId = url.searchParams.get("userId");

    if (!userId || (role !== "publisher" && role !== "subscriber")) {
      return new Response("Bad Request: missing role or userId", { status: 400 });
    }

    if (role === "publisher") {
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response("Unauthorized: missing token", { status: 401 });
      }

      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user || user.id !== userId) {
        return new Response("Unauthorized: invalid token", { status: 401 });
      }

      const session_id = crypto.randomUUID();
      const stream_id = await findCurrentStreamId(userId);

      const upgraded = server.upgrade(req, {
        data: { role: "publisher", userId, session_id },
      });
      if (!upgraded) return new Response("Upgrade Failed", { status: 500 });

      console.log(`[publisher] connected userId=${userId} session=${session_id} stream=${stream_id ?? "none"}`);

      rooms.set(userId, {
        publisher: null, // set in open()
        subscribers: new Set(),
        session_id,
        stream_id,
      });

      return undefined;
    }

    // subscriber
    const upgraded = server.upgrade(req, {
      data: { role: "subscriber", userId },
    });
    if (!upgraded) return new Response("Upgrade Failed", { status: 500 });
    return undefined;
  },

  websocket: {
    open(ws) {
      const { role, userId } = ws.data;

      if (role === "publisher") {
        const room = rooms.get(userId);
        if (room) room.publisher = ws;
      } else {
        const room = rooms.get(userId);
        if (room) {
          room.subscribers.add(ws);
        } else {
          // Publisher not yet connected — create a placeholder room
          rooms.set(userId, {
            publisher: null,
            subscribers: new Set([ws]),
            session_id: "",
            stream_id: null,
          });
        }
        console.log(`[subscriber] connected userId=${userId}`);
      }
    },

    message(ws, raw) {
      const { role, userId, session_id } = ws.data;

      if (role !== "publisher") return;

      let geo: GeoPayload;
      try {
        geo = JSON.parse(typeof raw === "string" ? raw : raw.toString()) as GeoPayload;
      } catch {
        console.warn(`[publisher] malformed message from userId=${userId}`);
        return;
      }

      const room = rooms.get(userId);
      if (!room) return;

      const broadcast = JSON.stringify({ type: "geo", payload: geo });
      for (const sub of room.subscribers) {
        sub.send(broadcast);
      }

      if (session_id) {
        insertGeoTrack(userId, session_id, room.stream_id, geo);
      }
    },

    close(ws) {
      const { role, userId } = ws.data;

      if (role === "publisher") {
        const room = rooms.get(userId);
        if (room) {
          const offline = JSON.stringify({ type: "status", payload: { status: "offline" } });
          for (const sub of room.subscribers) {
            sub.send(offline);
          }
          rooms.delete(userId);
          console.log(`[publisher] disconnected userId=${userId}`);
        }
      } else {
        const room = rooms.get(userId);
        if (room) {
          room.subscribers.delete(ws);
          // Clean up placeholder rooms with no publisher and no subscribers
          if (!room.publisher && room.subscribers.size === 0) {
            rooms.delete(userId);
          }
        }
        console.log(`[subscriber] disconnected userId=${userId}`);
      }
    },
  },
});

// Ping all connections every 30 s to keep them alive through Cloudflare (100 s idle timeout)
setInterval(() => {
  for (const room of rooms.values()) {
    room.publisher?.ping();
    for (const sub of room.subscribers) {
      sub.ping();
    }
  }
}, 30_000);

console.log(`[irl-ws-server] listening on port ${server.port}`);
