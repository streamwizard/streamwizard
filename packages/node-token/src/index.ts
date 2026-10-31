import { randomUUID } from "node:crypto";
import { createLocalJWKSet, errors, importJWK, jwtVerify, SignJWT, type JSONWebKeySet, type JWK } from "jose";

// Short-lived tokens for calls to an OBS node's API (obs-instance-manager).
//
// A node used to receive the caller's own Supabase access token, which works
// against the whole platform for about an hour. A node token instead names
// one node (aud), one action (scope) and, where it applies, one instance
// (iid), and expires after 60 seconds. It is signed with an Ed25519 key only
// the web apps hold; nodes get the public half through GET /api/nodes/me, so
// a node can check a token but never mint or alter one. One key pair per
// environment, shared by every node in it -- adding a node needs no new env.

export const NODE_TOKEN_ISSUER = "streamwizard-node-token";
export const NODE_TOKEN_TTL_SECONDS = 60;

/** Scopes a streamer's token can carry. */
export const USER_NODE_SCOPES = [
  "instances:create",
  "instances:read",
  "instances:control",
  "instances:delete",
  "files",
  "ws-ticket",
] as const;

/** Scopes only web-admin mints, always with role "admin". */
export const ADMIN_NODE_SCOPES = ["admin:instances", "admin:ws-ticket"] as const;

export type UserNodeScope = (typeof USER_NODE_SCOPES)[number];
export type AdminNodeScope = (typeof ADMIN_NODE_SCOPES)[number];
export type NodeTokenScope = UserNodeScope | AdminNodeScope;

export function isUserNodeScope(value: unknown): value is UserNodeScope {
  return typeof value === "string" && (USER_NODE_SCOPES as readonly string[]).includes(value);
}

export function isAdminNodeScope(value: unknown): value is AdminNodeScope {
  return typeof value === "string" && (ADMIN_NODE_SCOPES as readonly string[]).includes(value);
}

export interface NodeTokenInput {
  nodeId: string;
  userId: string;
  scope: NodeTokenScope;
  /** Required by the node on every route with an :id param. */
  instanceId?: string | null;
  role: "user" | "admin";
}

let signingKey: Promise<{ key: CryptoKey | Uint8Array; kid: string }> | null = null;

/** Parses NODE_TOKEN_SIGNING_JWK once per process. The JWK carries its own
 *  kid (the key's thumbprint, see scripts/generate-key.ts), which the node
 *  uses to pick the matching public key during a rotation. */
function loadSigningKey(): Promise<{ key: CryptoKey | Uint8Array; kid: string }> {
  if (signingKey) return signingKey;
  signingKey = (async () => {
    const raw = process.env.NODE_TOKEN_SIGNING_JWK;
    if (!raw) throw new Error("NODE_TOKEN_SIGNING_JWK is not set");
    const jwk = JSON.parse(raw) as JWK;
    if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.d || !jwk.kid) {
      throw new Error("NODE_TOKEN_SIGNING_JWK must be an Ed25519 private JWK with a kid");
    }
    return { key: await importJWK(jwk, "EdDSA"), kid: jwk.kid };
  })();
  // Don't cache a failure: a fixed env on the next request should just work.
  signingKey.catch(() => {
    signingKey = null;
  });
  return signingKey;
}

export async function signNodeToken(input: NodeTokenInput): Promise<string> {
  const { key, kid } = await loadSigningKey();
  return new SignJWT({
    scope: input.scope,
    role: input.role,
    ...(input.instanceId ? { iid: input.instanceId } : {}),
  })
    .setProtectedHeader({ alg: "EdDSA", kid, typ: "JWT" })
    .setIssuer(NODE_TOKEN_ISSUER)
    .setAudience(input.nodeId)
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime(`${NODE_TOKEN_TTL_SECONDS}s`)
    .setJti(randomUUID())
    .sign(key);
}

export interface VerifiedNodeToken {
  userId: string;
  scope: NodeTokenScope;
  instanceId: string | null;
  role: "user" | "admin";
  jti: string;
  /** Unix seconds. */
  expiresAt: number;
}

const CLOCK_TOLERANCE_SECONDS = 5;

/**
 * Checks a node token outside the node, for a service a node forwards it to
 * (rest-api, when a node creates an instance for the user who asked it to).
 * Same rules the node applies: our issuer, aud = that node, EdDSA, at most a
 * minute old. Throws on anything else.
 */
export async function verifyNodeToken(token: string, jwks: JSONWebKeySet, nodeId: string): Promise<VerifiedNodeToken> {
  const { payload } = await jwtVerify(token, createLocalJWKSet(jwks), {
    issuer: NODE_TOKEN_ISSUER,
    audience: nodeId,
    algorithms: ["EdDSA"],
    maxTokenAge: `${NODE_TOKEN_TTL_SECONDS}s`,
    clockTolerance: CLOCK_TOLERANCE_SECONDS,
    requiredClaims: ["sub", "exp", "iat", "jti"],
  });

  const { sub, scope, role, iid, jti, exp } = payload;
  if (typeof sub !== "string" || !sub) throw new errors.JWTClaimValidationFailed("missing sub", payload, "sub");
  if (!isUserNodeScope(scope) && !isAdminNodeScope(scope)) {
    throw new errors.JWTClaimValidationFailed("unknown scope", payload, "scope");
  }
  if (role !== "user" && role !== "admin") throw new errors.JWTClaimValidationFailed("unknown role", payload, "role");
  if (iid !== undefined && typeof iid !== "string") throw new errors.JWTClaimValidationFailed("bad iid", payload, "iid");
  if (typeof jti !== "string" || !jti) throw new errors.JWTClaimValidationFailed("missing jti", payload, "jti");

  return { userId: sub, scope, instanceId: iid ?? null, role, jti, expiresAt: exp! };
}

/** Test-only: forget the parsed key so a test can swap NODE_TOKEN_SIGNING_JWK. */
export function resetSigningKey(): void {
  signingKey = null;
}
