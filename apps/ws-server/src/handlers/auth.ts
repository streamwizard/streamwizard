import { timingSafeEqual } from "crypto";
import { env } from "../lib/env";
import { supabase } from "@repo/supabase";
import { getOverlaySceneBySubscriberToken } from "@repo/supabase/queries/overlays";
import { getLiveStreamIdByBroadcasterId } from "@repo/supabase/queries/live-status";
import { getIrlCollectorTokenUserId, touchIrlCollectorToken } from "@repo/supabase/queries/irl";
import { getTwitchUserIdByUserIdMaybe } from "@repo/supabase/queries/user";
import type { BotBroadcastMessage, OverlayEventType } from "@repo/types";
import { trackWsAuthFailure } from "@repo/metrics";
import { isRateLimited } from "../rate-limit";
import { rooms } from "../rooms";
import { routeBotBroadcast } from "../bot-router";
import type { ConnectionData } from "../types";

type BunServer = import("bun").Server<ConnectionData>;

const VALID_ROLES = new Set(["publisher", "subscriber", "bot", "monitor", "consumer"]);

function isValidSecret(candidate: string | null | undefined, secret: string): boolean {
  const candidateBuf = Buffer.from(candidate ?? "");
  const secretBuf = Buffer.from(secret);
  return candidateBuf.length === secretBuf.length && timingSafeEqual(candidateBuf, secretBuf);
}

// Server-to-server injection of a bot-shaped broadcast over plain HTTP —
// lets web server actions push config/override changes to the consumer feed
// (and the user's room) with a fetch instead of a WS handshake.
async function handleInternalBroadcast(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  if (!env.CONSUMER_SECRET) {
    return new Response("Not Found", { status: 404 });
  }
  const key = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!isValidSecret(key, env.CONSUMER_SECRET)) {
    trackWsAuthFailure("bot", "invalid_bot_key");
    return new Response("Unauthorized", { status: 401 });
  }

  let msg: BotBroadcastMessage;
  try {
    msg = (await req.json()) as BotBroadcastMessage;
  } catch {
    return new Response("Bad Request: invalid JSON", { status: 400 });
  }
  if (typeof msg.userId !== "string" || msg.userId.length === 0 || typeof msg.type !== "string" || msg.type.length === 0) {
    return new Response("Bad Request: userId and type are required", { status: 400 });
  }

  const { delivered } = routeBotBroadcast(msg, "internal-http");
  return Response.json({ ok: true, delivered });
}

let nextConnId = 1;

async function findCurrentStreamId(userId: string): Promise<string | null> {
  try {
    const twitchUserId = await getTwitchUserIdByUserIdMaybe(supabase, userId);
    if (!twitchUserId) return null;
    return await getLiveStreamIdByBroadcasterId(supabase, twitchUserId);
  } catch {
    return null;
  }
}

export async function handleUpgrade(req: Request, server: BunServer): Promise<Response | undefined> {
  const url = new URL(req.url);

  // Liveness probe for the monitoring alerter — plain HTTP, no upgrade.
  if (url.pathname === "/health") {
    return Response.json({ ok: true });
  }

  if (url.pathname === "/internal/broadcast") {
    return handleInternalBroadcast(req);
  }

  if (url.pathname !== "/ws") {
    return new Response("Not Found", { status: 404 });
  }

  const role = url.searchParams.get("role");

  if (!role || !VALID_ROLES.has(role)) {
    trackWsAuthFailure("unknown", "invalid_role");
    return new Response("Bad Request: missing or invalid role", { status: 400 });
  }

  // --- Monitor ---
  if (role === "monitor") {
    if (!env.MONITOR_SECRET) {
      return new Response("Monitor not configured", { status: 404 });
    }
    const token = url.searchParams.get("token");
    const tokenBuf = Buffer.from(token ?? "");
    const secretBuf = Buffer.from(env.MONITOR_SECRET);
    const valid = tokenBuf.length === secretBuf.length && timingSafeEqual(tokenBuf, secretBuf);
    if (!valid) {
      trackWsAuthFailure("unknown", "invalid_token");
      return new Response("Unauthorized", { status: 401 });
    }
    const upgraded = server.upgrade(req, {
      data: { role: "monitor" as const, userId: "_monitor", channels: new Set<OverlayEventType>(), connectedAt: Date.now(), connId: `c-${nextConnId++}` },
    });
    if (!upgraded) {
      trackWsAuthFailure("unknown", "upgrade_failed");
      return new Response("Upgrade Failed", { status: 500 });
    }
    return undefined;
  }

  // --- Bot ---
  if (role === "bot") {
    const key = req.headers.get("authorization")?.replace("Bearer ", "");
    if (key !== env.SUPABASE_SECRET_KEY) {
      trackWsAuthFailure("bot", "invalid_bot_key");
      return new Response("Unauthorized", { status: 401 });
    }
    // Self-declared identity label ("ingest-node:<id>"). Never reject on a
    // bad/missing source — older bot clients don't send one — just fall back,
    // and constrain the charset so it's safe as a metrics tag.
    const rawSource = url.searchParams.get("source");
    const source = rawSource && /^[a-zA-Z0-9:_.-]{1,64}$/.test(rawSource) ? rawSource : "unknown";
    const upgraded = server.upgrade(req, {
      data: { role: "bot", userId: "_bot", source, channels: new Set<OverlayEventType>(), connectedAt: Date.now(), connId: `c-${nextConnId++}` },
    });
    if (!upgraded) {
      trackWsAuthFailure("bot", "upgrade_failed");
      return new Response("Upgrade Failed", { status: 500 });
    }
    return undefined;
  }

  // --- Consumer (trusted server-side firehose: obs-auto-switcher) ---
  if (role === "consumer") {
    if (!env.CONSUMER_SECRET) {
      return new Response("Consumer not configured", { status: 404 });
    }
    const key = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!isValidSecret(key, env.CONSUMER_SECRET)) {
      trackWsAuthFailure("consumer", "invalid_bot_key");
      return new Response("Unauthorized", { status: 401 });
    }
    const rawSource = url.searchParams.get("source");
    const source = rawSource && /^[a-zA-Z0-9:_.-]{1,64}$/.test(rawSource) ? rawSource : "unknown";
    const rawTypes = url.searchParams.get("types");
    const consumerTypes = rawTypes
      ? new Set(rawTypes.split(",").map((s) => s.trim()).filter((s) => s.length > 0))
      : new Set<string>();
    const upgraded = server.upgrade(req, {
      data: {
        role: "consumer" as const,
        userId: "_consumer",
        source,
        consumerTypes,
        channels: new Set<OverlayEventType>(),
        connectedAt: Date.now(),
        connId: `c-${nextConnId++}`,
      },
    });
    if (!upgraded) {
      trackWsAuthFailure("consumer", "upgrade_failed");
      return new Response("Upgrade Failed", { status: 500 });
    }
    return undefined;
  }

  // --- Publisher ---
  if (role === "publisher") {
    const token = url.searchParams.get("token");
    if (!token) {
      trackWsAuthFailure("publisher", "missing_token");
      return new Response("Unauthorized: missing token", { status: 401 });
    }

    let resolvedUserId: string | null = null;

    // Path A: Supabase JWT
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) resolvedUserId = user.id;

    // Path B: irl_collector_tokens DB lookup
    if (!resolvedUserId) {
      resolvedUserId = await getIrlCollectorTokenUserId(supabase, token);
      if (resolvedUserId) {
        touchIrlCollectorToken(supabase, token);
      }
    }

    if (!resolvedUserId) {
      trackWsAuthFailure("publisher", "invalid_token");
      return new Response("Unauthorized: invalid token", { status: 401 });
    }

    const session_id = crypto.randomUUID();
    const stream_id = await findCurrentStreamId(resolvedUserId);

    const upgraded = server.upgrade(req, {
      data: { role: "publisher", userId: resolvedUserId, session_id, channels: new Set<OverlayEventType>(), connectedAt: Date.now(), connId: `c-${nextConnId++}` },
    });
    if (!upgraded) {
      trackWsAuthFailure("publisher", "upgrade_failed");
      return new Response("Upgrade Failed", { status: 500 });
    }

    console.log(`[publisher] connected userId=${resolvedUserId} session=${session_id} stream=${stream_id ?? "none"}`);

    const existingRoom = rooms.get(resolvedUserId);
    rooms.set(resolvedUserId, {
      publisher: null,
      subscribers: existingRoom?.subscribers ?? new Set(),
      session_id,
      stream_id,
    });

    return undefined;
  }

  // --- Subscriber ---
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(ip)) {
    trackWsAuthFailure("subscriber", "rate_limited");
    return new Response("Too Many Requests", { status: 429 });
  }

  const subscriberToken = url.searchParams.get("token");
  if (!subscriberToken) {
    trackWsAuthFailure("subscriber", "missing_token");
    return new Response("Unauthorized: missing token", { status: 401 });
  }

  let subscriberUserId: string | null = null;

  // Path A: Supabase JWT — a logged-in dashboard user subscribing to their own room
  // (e.g. live ingest stats), not tied to any particular overlay scene.
  const { data: { user: subscriberUser } } = await supabase.auth.getUser(subscriberToken);
  if (subscriberUser) subscriberUserId = subscriberUser.id;

  // Path B: overlay subscriber token (browser-source overlays, widget preview).
  if (!subscriberUserId) {
    const { data: scene } = await getOverlaySceneBySubscriberToken(supabase, subscriberToken);
    if (scene) subscriberUserId = scene.user_id;
  }

  if (!subscriberUserId) {
    trackWsAuthFailure("subscriber", "invalid_token");
    return new Response("Unauthorized: invalid token", { status: 401 });
  }

  const rawChannels = url.searchParams.get("channels");
  const channels = rawChannels
    ? new Set(rawChannels.split(",").map((s) => s.trim()) as OverlayEventType[])
    : new Set<OverlayEventType>();

  const upgraded = server.upgrade(req, {
    data: { role: "subscriber", userId: subscriberUserId, channels, connectedAt: Date.now(), connId: `c-${nextConnId++}` },
  });
  if (!upgraded) {
    trackWsAuthFailure("subscriber", "upgrade_failed");
    return new Response("Upgrade Failed", { status: 500 });
  }
  return undefined;
}
