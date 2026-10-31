import { NODE_TOKEN_TTL_SECONDS, verifyNodeToken } from "@repo/node-token";
import { TtlCache } from "@repo/ttl-cache";
import type { NodeTokenJwks } from "./node-token-jwks";

// POST /api/nodes/instances takes user_id from the node. The node API key
// alone can't prove that user asked for an instance there, and a row on a
// node is what releases the user's stream key to it. So the node forwards the
// instances:create token the web app signed for that launch: it names the
// user (sub) and this node (aud), and only the web apps can sign one.

/** Remembered until well past exp, so a token can create one row, once. */
const usedJtis = new TtlCache<true>({ ttlMs: (NODE_TOKEN_TTL_SECONDS + 30) * 1000, maxEntries: 10_000 });

let warnedLegacy = false;

export type CreateTokenCheck = { ok: true } | { ok: false; status: 401 | 403 | 503; error: string };

export async function checkInstanceCreateToken(input: {
  token: string | undefined;
  nodeId: string;
  userId: string;
  jwks: NodeTokenJwks | null;
  /** Off until every node forwards the token; then nothing gets in without one. */
  required: boolean;
}): Promise<CreateTokenCheck> {
  const { token, nodeId, userId, jwks, required } = input;

  if (!token) {
    if (required) return { ok: false, status: 401, error: "Missing node token" };
    if (!warnedLegacy) {
      warnedLegacy = true;
      console.warn("[nodes] instance created without a node token; set NODE_CREATE_TOKEN_REQUIRED once every node forwards one");
    }
    return { ok: true };
  }
  if (!jwks) return { ok: false, status: 503, error: "Node tokens are not configured" };

  let claims;
  try {
    claims = await verifyNodeToken(token, jwks, nodeId);
  } catch {
    return { ok: false, status: 401, error: "Invalid or expired node token" };
  }
  if (claims.scope !== "instances:create" || claims.role !== "user") {
    return { ok: false, status: 403, error: "Node token does not allow creating instances" };
  }
  if (claims.userId !== userId) return { ok: false, status: 403, error: "Node token is for another user" };
  if (usedJtis.get(claims.jti)) return { ok: false, status: 401, error: "Node token already used" };
  usedJtis.set(claims.jti, true);
  return { ok: true };
}

/** Test-only. */
export function resetInstanceCreateTokenState(): void {
  usedJtis.clear();
  warnedLegacy = false;
}
