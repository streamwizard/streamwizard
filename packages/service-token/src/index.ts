import { randomUUID } from "node:crypto";
import { decodeProtectedHeader, errors, importJWK, jwtVerify, SignJWT, type JWK } from "jose";

// Short-lived tokens our own services use to call ws-server.
//
// ws-server used to trust one shared secret (and, for bot sockets, the
// Supabase service-role key). Every holder could do everything: push any
// event to any user, close anyone's sockets, read the firehose. Now each
// service has its own Ed25519 key and signs a 60-second token for the one
// thing it is about to do. ws-server holds only the public keys, knows which
// service each key belongs to, and checks the action against SERVICE_POLICY.
// A leaked key is limited to that service's actions; ws-server holds no
// secret at all.

export const SERVICE_TOKEN_ISSUER = "streamwizard-service-token";
export const SERVICE_TOKEN_AUDIENCE = "ws-server";
export const SERVICE_TOKEN_TTL_SECONDS = 60;

/** What a token can be used for. One scope per token. */
export const SERVICE_SCOPES = [
  /** POST /internal/broadcast */
  "broadcast",
  /** POST /internal/revoke */
  "revoke",
  /** role=consumer socket: the firehose of every user's events */
  "consumer",
  /** role=bot socket: push events into any user's room */
  "bot",
  /** role=ingest-node socket: one ingest node's live data. rest-api signs
   *  these for a node (claim `node`); the node holds the token, not a key. */
  "ingest-node",
  /** POST /internal/ingest-sessions(/:id/end): the live session registry */
  "ingest-sessions",
  /** role=monitor socket: the sanitized ops feed. web-admin signs these in a
   *  server action after its admin check; the admin's browser holds the
   *  token, not a key. */
  "monitor",
] as const;
export type ServiceScope = (typeof SERVICE_SCOPES)[number];

/** Every service that calls ws-server, and what each one may do. */
export const SERVICE_POLICY = {
  "rest-api": ["broadcast", "revoke", "ingest-node", "ingest-sessions"],
  "web-streamwizard": ["broadcast", "revoke"],
  "web-admin": ["broadcast", "revoke", "monitor"],
  "web-overlay": ["broadcast"],
  "obs-auto-switcher": ["consumer", "bot"],
  "streamwizard-bot": ["bot"],
} as const satisfies Record<string, readonly ServiceScope[]>;
export type ServiceName = keyof typeof SERVICE_POLICY;
export const SERVICE_NAMES = Object.keys(SERVICE_POLICY) as ServiceName[];

export function isServiceName(value: unknown): value is ServiceName {
  return typeof value === "string" && Object.hasOwn(SERVICE_POLICY, value);
}

export function serviceMay(service: ServiceName, scope: ServiceScope): boolean {
  return (SERVICE_POLICY[service] as readonly ServiceScope[]).includes(scope);
}

/** Extra claims a token can carry, e.g. `node` on an ingest-node token. */
export type ServiceTokenClaims = Record<string, string>;

/** Claims the token format owns; extra claims can't replace them. */
const RESERVED_CLAIMS = new Set(["iss", "aud", "sub", "iat", "exp", "nbf", "jti", "scope"]);

/** Scopes whose tokens must name something, and which claim does it. */
const REQUIRED_CLAIM: Partial<Record<ServiceScope, string>> = { "ingest-node": "node" };

function checkRequiredClaim(scope: ServiceScope, claims: ServiceTokenClaims): void {
  const name = REQUIRED_CLAIM[scope];
  if (name && !(typeof claims[name] === "string" && claims[name].length > 0)) {
    throw new Error(`a ${scope} token needs a non-empty ${name} claim`);
  }
}

/** A key as stored: a JWK plus the service it belongs to (`svc`). */
export type ServiceJwk = JWK & { kid: string; svc: ServiceName };

// ── Signing (the calling services) ──────────────────────────────────────────

type SigningKey = { key: CryptoKey | Uint8Array; kid: string; service: ServiceName };
let signingKey: Promise<SigningKey> | null = null;

/** Parses WS_SERVICE_SIGNING_JWK once per process. */
function loadSigningKey(raw: string): Promise<SigningKey> {
  if (signingKey) return signingKey;
  signingKey = (async () => {
    const jwk = JSON.parse(raw) as Partial<ServiceJwk>;
    if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.d || !jwk.kid || !isServiceName(jwk.svc)) {
      throw new Error("WS_SERVICE_SIGNING_JWK must be an Ed25519 private JWK with a kid and a known svc");
    }
    return { key: await importJWK(jwk, "EdDSA"), kid: jwk.kid, service: jwk.svc };
  })();
  // Don't cache a failure: a fixed env on the next call should just work.
  signingKey.catch(() => {
    signingKey = null;
  });
  return signingKey;
}

/** True when this process has a service signing key. */
export function hasServiceSigningKey(): boolean {
  return Boolean(process.env.WS_SERVICE_SIGNING_JWK);
}

/**
 * Signs a 60-second token for one action. `claims` adds fields such as
 * `{ node }` on an ingest-node token; they can't replace the token's own
 * claims. Throws if this service has no key, or a required claim is missing.
 */
export async function signServiceToken(scope: ServiceScope, claims: ServiceTokenClaims = {}): Promise<string> {
  const raw = process.env.WS_SERVICE_SIGNING_JWK;
  if (!raw) throw new Error("WS_SERVICE_SIGNING_JWK is not set");
  for (const name of Object.keys(claims)) {
    if (RESERVED_CLAIMS.has(name)) throw new Error(`claim ${name} is reserved`);
  }
  checkRequiredClaim(scope, claims);
  const { key, kid, service } = await loadSigningKey(raw);
  return new SignJWT({ ...claims, scope })
    .setProtectedHeader({ alg: "EdDSA", kid, typ: "JWT" })
    .setIssuer(SERVICE_TOKEN_ISSUER)
    .setAudience(SERVICE_TOKEN_AUDIENCE)
    .setSubject(service)
    .setIssuedAt()
    .setExpirationTime(`${SERVICE_TOKEN_TTL_SECONDS}s`)
    .setJti(randomUUID())
    .sign(key);
}

/**
 * The Authorization header for one ws-server call: a fresh service token when
 * this service has WS_SERVICE_SIGNING_JWK, else null (ws-server calls are off
 * here).
 */
export async function serviceAuthHeader(scope: ServiceScope): Promise<string | null> {
  if (process.env.WS_SERVICE_SIGNING_JWK) return `Bearer ${await signServiceToken(scope)}`;
  return null;
}

// ── Verifying (ws-server) ───────────────────────────────────────────────────

const CLOCK_TOLERANCE_SECONDS = 5;

/** Same three-part shape every JWT has. */
export function looksLikeJwt(token: string): boolean {
  return token.split(".").length === 3;
}

export interface VerifiedServiceToken {
  service: ServiceName;
  /** The token's extra claims (string values only), e.g. `node`. */
  claims: ServiceTokenClaims;
}

export type ServiceTokenVerifier = (token: string, scope: ServiceScope) => Promise<VerifiedServiceToken>;

/**
 * Builds a verifier from WS_SERVICE_JWKS ({ keys: ServiceJwk[] }). It returns
 * the calling service and the token's extra claims, or throws when the token
 * is invalid, the key is not bound to the service in `sub`, the token was
 * signed for another action, the service may not do this action, or a claim
 * the action needs is missing.
 */
export function createServiceTokenVerifier(jwks: { keys: ServiceJwk[] }): ServiceTokenVerifier {
  const byKid = new Map<string, { jwk: ServiceJwk; key: Promise<CryptoKey | Uint8Array> }>();
  for (const jwk of jwks.keys) {
    if (!jwk.kid || !isServiceName(jwk.svc)) throw new Error("every WS_SERVICE_JWKS key needs a kid and a known svc");
    if (jwk.d) throw new Error("WS_SERVICE_JWKS must hold public keys only");
    byKid.set(jwk.kid, { jwk, key: importJWK(jwk, "EdDSA") });
  }

  return async (token, scope) => {
    const { kid, alg } = decodeProtectedHeader(token);
    if (alg !== "EdDSA") throw new errors.JOSEAlgNotAllowed("only EdDSA service tokens are accepted");
    const entry = kid ? byKid.get(kid) : undefined;
    if (!entry) throw new errors.JWKSNoMatchingKey("unknown service key");

    const { payload } = await jwtVerify(token, await entry.key, {
      issuer: SERVICE_TOKEN_ISSUER,
      audience: SERVICE_TOKEN_AUDIENCE,
      algorithms: ["EdDSA"],
      maxTokenAge: `${SERVICE_TOKEN_TTL_SECONDS}s`,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      requiredClaims: ["sub", "exp", "iat", "jti"],
    });

    const service = entry.jwk.svc;
    if (payload.sub !== service) throw new errors.JWTClaimValidationFailed("key belongs to another service", payload, "sub");
    if (payload.scope !== scope) throw new errors.JWTClaimValidationFailed("token is for another action", payload, "scope");
    if (!serviceMay(service, scope)) {
      throw new errors.JWTClaimValidationFailed(`${service} may not ${scope}`, payload, "scope");
    }
    const claims: ServiceTokenClaims = {};
    for (const [name, value] of Object.entries(payload)) {
      if (!RESERVED_CLAIMS.has(name) && typeof value === "string") claims[name] = value;
    }
    try {
      checkRequiredClaim(scope, claims);
    } catch (err) {
      throw new errors.JWTClaimValidationFailed((err as Error).message, payload, REQUIRED_CLAIM[scope]);
    }
    return { service, claims };
  };
}

/** Test-only: forget the parsed key so a test can swap WS_SERVICE_SIGNING_JWK. */
export function resetSigningKey(): void {
  signingKey = null;
}
