import type { JWK } from "jose";
import { isServiceName, type ServiceName } from "./policy";

/** A key as stored: a JWK plus the service it belongs to (`svc`). */
export type ServiceJwk = JWK & { kid: string; svc: ServiceName };

/**
 * Reads a WS_SERVICE_SIGNING_JWK value: an Ed25519 private JWK with a `kid`
 * and a known `svc`. Returns null for anything else. It reads no environment
 * and imports no crypto, so app env schemas can call it at boot, including in
 * a Next app whose env.ts also ends up in the browser bundle.
 */
export function parseServiceSigningJwk(raw: string): ServiceJwk | null {
  let jwk: unknown;
  try {
    jwk = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof jwk !== "object" || jwk === null) return null;
  const key = jwk as Partial<ServiceJwk>;
  if (key.kty !== "OKP" || key.crv !== "Ed25519" || !key.d || !key.kid || !isServiceName(key.svc)) return null;
  return key as ServiceJwk;
}

/** True when `raw` is a usable WS_SERVICE_SIGNING_JWK. For env schema refinements. */
export function isServiceSigningJwk(raw: string): boolean {
  return parseServiceSigningJwk(raw) !== null;
}

export const SERVICE_SIGNING_JWK_ERROR = "must be an Ed25519 private JWK with a kid and a known svc";
