import {
  createServiceTokenVerifier,
  type ServiceJwk,
  type ServiceScope,
  type ServiceTokenClaims,
} from "@repo/service-token";
import { env } from "@/lib/env";
import { readBearerToken } from "@repo/service-token/bearer";

// Who may call ws-server's server-to-server surface, and for what. Each of our
// services signs a 60-second token per action (@repo/service-token); the
// public keys and the service each one belongs to come from WS_SERVICE_JWKS.
// There is no shared secret: without WS_SERVICE_JWKS nothing gets in.

export type ServiceAuthResult =
  | { ok: true; service: string; claims: ServiceTokenClaims }
  | { ok: false; reason: "missing" | "invalid" };

export interface ServiceAuthConfig {
  /** WS_SERVICE_JWKS, parsed by lib/env.ts. */
  jwks?: { keys: ServiceJwk[] };
}

export function createServiceAuth(config: ServiceAuthConfig) {
  const verify = config.jwks ? createServiceTokenVerifier(config.jwks) : null;

  return {
    /** False when this environment has no service keys, so no action can be authorized. */
    configured(_scope: ServiceScope): boolean {
      return verify !== null;
    },

    /** Checks `Authorization: Bearer <service token>` for one action. Never throws. */
    async authorize(header: string | null, scope: ServiceScope): Promise<ServiceAuthResult> {
      const token = readBearerToken(header) ?? "";
      if (!token) return { ok: false, reason: "missing" };
      if (!verify) return { ok: false, reason: "invalid" };
      try {
        const { service, claims } = await verify(token, scope);
        return { ok: true, service, claims };
      } catch {
        return { ok: false, reason: "invalid" };
      }
    },
  };
}

const serviceAuth = createServiceAuth({ jwks: env.WS_SERVICE_JWKS });

export const serviceAuthConfigured = serviceAuth.configured;
export const authorizeService = serviceAuth.authorize;
