import { supabase } from "@repo/supabase";
import { getOverlaySceneBySubscriberToken } from "@repo/supabase/queries/overlays";
import { trackWsAuthFailure } from "@repo/metrics";
import { isRateLimited } from "@/middleware/rate-limit";
import { authorizeService, serviceAuthConfigured } from "@/middleware/service-auth";
import type { ConnectionData } from "@/types";
import { parseUpgradeQuery } from "./schemas";

type BunServer = import("bun").Server<ConnectionData>;

/** Monotonic per-connection id, used for metrics and the monitor feed. */
let nextConnId = 1;

/**
 * Resolves a subscriber token to a user id. Two kinds are accepted: a Supabase
 * JWT (a signed-in dashboard user) or an overlay scene's subscriber token (a
 * browser source, which has no session).
 *
 * The two shapes never overlap, so each token costs at most one Supabase call
 * and anything of neither shape costs none: subscriber_token is always 32
 * random bytes as lowercase hex, a JWT is three base64url segments.
 *
 * The kind and token are kept on the socket so modules/revoke can re-check them
 * after a key reset, a scene delete or an account deletion.
 */
const SCENE_TOKEN = /^[0-9a-f]{64}$/;
const JWT = /^[\w-]+\.[\w-]+\.[\w-]+$/;
const MAX_JWT_LENGTH = 16_384;

async function resolveToken(token: string): Promise<{ userId: string; credential: NonNullable<ConnectionData["credential"]> } | null> {
  if (SCENE_TOKEN.test(token)) {
    const { data: scene } = await getOverlaySceneBySubscriberToken(supabase, token);
    return scene ? { userId: scene.user_id, credential: { kind: "scene", token } } : null;
  }

  if (token.length <= MAX_JWT_LENGTH && JWT.test(token)) {
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    return user ? { userId: user.id, credential: { kind: "session", token } } : null;
  }

  return null;
}

function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown";
}

/** Every role ends the same way: upgrade, or report why it couldn't. */
function upgradeOrFail(
  server: BunServer,
  req: Request,
  role: ConnectionData["role"],
  data: Omit<ConnectionData, "connectedAt" | "connId">,
): Response | undefined {
  const upgraded = server.upgrade(req, {
    data: { ...data, connectedAt: Date.now(), connId: `c-${nextConnId++}` } as ConnectionData,
  });
  if (!upgraded) {
    // Ingest nodes report under the bot label, as they did when they were bots.
    trackWsAuthFailure(role === "monitor" ? "unknown" : role === "ingest-node" ? "bot" : role, "upgrade_failed");
    return new Response("Upgrade Failed", { status: 500 });
  }
  return undefined;
}

export async function handleUpgrade(req: Request, server: BunServer): Promise<Response | undefined> {
  const url = new URL(req.url);

  if (url.pathname !== "/ws") {
    return new Response("Not Found", { status: 404 });
  }

  const parsedQuery = parseUpgradeQuery(url);
  if (!parsedQuery.ok) {
    // A malformed token or channel list counts with the bad tokens.
    const invalidRole = parsedQuery.reason === "invalid_role";
    trackWsAuthFailure("unknown", invalidRole ? "invalid_role" : "invalid_token");
    return new Response(invalidRole ? "Bad Request: missing or invalid role" : "Bad Request", { status: 400 });
  }
  const { role, token, channels, types } = parsedQuery.query;

  // --- Monitor (the sanitized ops feed; token signed by web-admin) ---
  // Browsers can't set headers on a WebSocket, so the admin page sends its
  // 60-second service token as ?token=. It fetches a fresh one before every
  // dial; the Authorization header works too, for server-side callers.
  if (role === "monitor") {
    if (!serviceAuthConfigured("monitor")) {
      return new Response("Monitor not configured", { status: 404 });
    }
    const auth = await authorizeService(req.headers.get("authorization") ?? (token ? `Bearer ${token}` : null), "monitor");
    if (!auth.ok) {
      trackWsAuthFailure("unknown", "invalid_token");
      return new Response("Unauthorized", { status: 401 });
    }
    return upgradeOrFail(server, req, "monitor", {
      role: "monitor",
      userId: "_monitor",
      source: auth.service,
      channels: new Set<string>(),
    });
  }

  // --- Bot ---
  if (role === "bot") {
    const auth = await authorizeService(req.headers.get("authorization"), "bot");
    if (!auth.ok) {
      trackWsAuthFailure("bot", "invalid_bot_key");
      return new Response("Unauthorized", { status: 401 });
    }
    return upgradeOrFail(server, req, "bot", {
      role: "bot",
      userId: "_bot",
      source: auth.service,
      channels: new Set<string>(),
    });
  }

  // --- Consumer (trusted server-side firehose: obs-auto-switcher) ---
  if (role === "consumer") {
    if (!serviceAuthConfigured("consumer")) {
      return new Response("Consumer not configured", { status: 404 });
    }
    const auth = await authorizeService(req.headers.get("authorization"), "consumer");
    if (!auth.ok) {
      trackWsAuthFailure("consumer", "invalid_bot_key");
      return new Response("Unauthorized", { status: 401 });
    }
    return upgradeOrFail(server, req, "consumer", {
      role: "consumer",
      userId: "_consumer",
      source: auth.service,
      consumerTypes: types,
      channels: new Set<string>(),
    });
  }

  // --- Ingest node (one ingest node's live data; token signed by rest-api) ---
  if (role === "ingest-node") {
    if (!serviceAuthConfigured("ingest-node")) {
      return new Response("Ingest nodes not configured", { status: 404 });
    }
    const auth = await authorizeService(req.headers.get("authorization"), "ingest-node");
    const nodeId = auth.ok ? auth.claims.node : undefined;
    if (!auth.ok || !nodeId) {
      trackWsAuthFailure("bot", "invalid_bot_key");
      return new Response("Unauthorized", { status: 401 });
    }
    return upgradeOrFail(server, req, "ingest-node", {
      role: "ingest-node",
      userId: "_bot",
      ingestNodeId: nodeId,
      source: `ingest-node:${nodeId}`,
      channels: new Set<string>(),
    });
  }

  // --- Subscriber ---
  if (isRateLimited("subscriber", clientIp(req))) {
    trackWsAuthFailure("subscriber", "rate_limited");
    return new Response("Too Many Requests", { status: 429 });
  }

  const subscriberToken = token;
  if (!subscriberToken) {
    trackWsAuthFailure("subscriber", "missing_token");
    return new Response("Unauthorized: missing token", { status: 401 });
  }

  const subscriber = await resolveToken(subscriberToken);
  if (!subscriber) {
    trackWsAuthFailure("subscriber", "invalid_token");
    return new Response("Unauthorized: invalid token", { status: 401 });
  }

  return upgradeOrFail(server, req, "subscriber", {
    role: "subscriber",
    userId: subscriber.userId,
    channels,
    credential: subscriber.credential,
  });
}
