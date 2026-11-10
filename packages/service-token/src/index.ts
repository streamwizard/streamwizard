import { randomUUID } from "node:crypto";
import { decodeProtectedHeader, errors, importJWK, jwtVerify, SignJWT } from "jose";

// Short-lived tokens our own services use to call each other.
//
// Each service has its own Ed25519 key and signs a 60-second token for the one
// thing it is about to do. The token is addressed to the one service that
// handles that action (its audience, from SCOPE_AUDIENCE). The receiving
// service holds only public keys, knows which service each key belongs to,
// and checks the action against SERVICE_POLICY. A leaked key is limited to
// that service's actions, and no receiver holds a secret at all.

export const SERVICE_TOKEN_ISSUER = "streamwizard-service-token";
export const SERVICE_TOKEN_TTL_SECONDS = 60;

import {
  isServiceName,
  SCOPE_AUDIENCE,
  serviceMay,
  type ServiceAudience,
  type ServiceName,
  type ServiceScope,
} from "./policy";
import { parseServiceSigningJwk, SERVICE_SIGNING_JWK_ERROR, type ServiceJwk } from "./signing-jwk";

export {
  SERVICE_SCOPES,
  SERVICE_POLICY,
  SERVICE_NAMES,
  SERVICE_AUDIENCES,
  SCOPE_AUDIENCE,
  isServiceName,
  serviceMay,
  type ServiceScope,
  type ServiceName,
  type ServiceAudience,
} from "./policy";
export { type ServiceJwk } from "./signing-jwk";
export { createServiceAuth, type ServiceAuth, type ServiceAuthConfig, type ServiceAuthResult } from "./service-auth";

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

// ── Signing (the calling services) ──────────────────────────────────────────

type SigningKey = { key: CryptoKey | Uint8Array; kid: string; service: ServiceName };
let signingKey: Promise<SigningKey> | null = null;

/** Parses WS_SERVICE_SIGNING_JWK once per process. */
function loadSigningKey(raw: string): Promise<SigningKey> {
  if (signingKey) return signingKey;
  signingKey = (async () => {
    const jwk = parseServiceSigningJwk(raw);
    if (!jwk) throw new Error(`WS_SERVICE_SIGNING_JWK ${SERVICE_SIGNING_JWK_ERROR}`);
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
    .setAudience(SCOPE_AUDIENCE[scope])
    .setSubject(service)
    .setIssuedAt()
    .setExpirationTime(`${SERVICE_TOKEN_TTL_SECONDS}s`)
    .setJti(randomUUID())
    .sign(key);
}

/**
 * The Authorization header for one service call: a fresh service token when
 * this service has WS_SERVICE_SIGNING_JWK, else null (those calls are off
 * here).
 */
export async function serviceAuthHeader(scope: ServiceScope): Promise<string | null> {
  if (process.env.WS_SERVICE_SIGNING_JWK) return `Bearer ${await signServiceToken(scope)}`;
  return null;
}

// ── Verifying (the receiving services) ──────────────────────────────────────

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
 * Builds the verifier for one receiving service (`audience`) from its public
 * key set ({ keys: ServiceJwk[] }, e.g. WS_SERVICE_JWKS). It returns the
 * calling service and the token's extra claims, or throws when the token is
 * invalid or addressed to another service, the key is not bound to the
 * service in `sub`, the token was signed for another action, the service may
 * not do this action, or a claim the action needs is missing.
 */
export function createServiceTokenVerifier(jwks: { keys: ServiceJwk[] }, audience: ServiceAudience): ServiceTokenVerifier {
  const byKid = new Map<string, { jwk: ServiceJwk; key: Promise<CryptoKey | Uint8Array> }>();
  for (const jwk of jwks.keys) {
    if (!jwk.kid || !isServiceName(jwk.svc)) throw new Error("every service JWKS key needs a kid and a known svc");
    if (jwk.d) throw new Error("a service JWKS must hold public keys only");
    byKid.set(jwk.kid, { jwk, key: importJWK(jwk, "EdDSA") });
  }

  return async (token, scope) => {
    // A route asking for another service's action is a wiring bug, not a bad token.
    if (SCOPE_AUDIENCE[scope] !== audience) throw new Error(`${audience} does not handle ${scope}`);
    const { kid, alg } = decodeProtectedHeader(token);
    if (alg !== "EdDSA") throw new errors.JOSEAlgNotAllowed("only EdDSA service tokens are accepted");
    const entry = kid ? byKid.get(kid) : undefined;
    if (!entry) throw new errors.JWKSNoMatchingKey("unknown service key");

    const { payload } = await jwtVerify(token, await entry.key, {
      issuer: SERVICE_TOKEN_ISSUER,
      audience,
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
