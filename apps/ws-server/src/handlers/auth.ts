import { env } from "@repo/env";
import { supabase } from "@repo/supabase";
import { getOverlaySceneBySubscriberToken } from "@repo/supabase/queries/overlays";
import { getLiveStreamIdByBroadcasterId } from "@repo/supabase/queries/live-status";
import { getIrlCollectorTokenUserId, touchIrlCollectorToken } from "@repo/supabase/queries/irl";
import { getTwitchUserIdByUserIdMaybe } from "@repo/supabase/queries/user";
import type { OverlayEventType } from "@repo/types";
import { isRateLimited } from "../rate-limit";
import { rooms } from "../rooms";
import type { ConnectionData } from "../types";

type BunServer = import("bun").Server<ConnectionData>;

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

  if (url.pathname !== "/ws") {
    return new Response("Not Found", { status: 404 });
  }

  const role = url.searchParams.get("role");

  if (role !== "publisher" && role !== "subscriber" && role !== "bot") {
    return new Response("Bad Request: missing or invalid role", { status: 400 });
  }

  // --- Bot ---
  if (role === "bot") {
    const key = req.headers.get("authorization")?.replace("Bearer ", "");
    if (key !== env.SUPABASE_SECRET_KEY) {
      return new Response("Unauthorized", { status: 401 });
    }
    const upgraded = server.upgrade(req, {
      data: { role: "bot", userId: "_bot", channels: new Set<OverlayEventType>() },
    });
    if (!upgraded) return new Response("Upgrade Failed", { status: 500 });
    return undefined;
  }

  // --- Publisher ---
  if (role === "publisher") {
    const token = url.searchParams.get("token");
    if (!token) return new Response("Unauthorized: missing token", { status: 401 });

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
      return new Response("Unauthorized: invalid token", { status: 401 });
    }

    const session_id = crypto.randomUUID();
    const stream_id = await findCurrentStreamId(resolvedUserId);

    const upgraded = server.upgrade(req, {
      data: { role: "publisher", userId: resolvedUserId, session_id, channels: new Set<OverlayEventType>() },
    });
    if (!upgraded) return new Response("Upgrade Failed", { status: 500 });

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
    return new Response("Too Many Requests", { status: 429 });
  }

  const subscriberToken = url.searchParams.get("token");
  if (!subscriberToken) {
    return new Response("Unauthorized: missing token", { status: 401 });
  }

  const { data: scene } = await getOverlaySceneBySubscriberToken(supabase, subscriberToken);
  if (!scene) {
    return new Response("Unauthorized: invalid token", { status: 401 });
  }

  const rawChannels = url.searchParams.get("channels");
  const channels = rawChannels
    ? new Set(rawChannels.split(",").map((s) => s.trim()) as OverlayEventType[])
    : new Set<OverlayEventType>();

  const upgraded = server.upgrade(req, {
    data: { role: "subscriber", userId: scene.user_id, channels },
  });
  if (!upgraded) return new Response("Upgrade Failed", { status: 500 });
  return undefined;
}
