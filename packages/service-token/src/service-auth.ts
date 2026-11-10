import { readBearerToken } from "./bearer";
import { createServiceTokenVerifier, type ServiceTokenClaims } from "./index";
import type { ServiceAudience, ServiceName, ServiceScope } from "./policy";
import type { ServiceJwk } from "./signing-jwk";

// The receiving side of service tokens, for one service: ws-server, rest-api
// /internal/* or the discord-bot HTTP API. Takes the public key set the app
// parsed from its env; without one nothing gets in.

export type ServiceAuthResult =
  | { ok: true; service: ServiceName; claims: ServiceTokenClaims }
  | { ok: false; reason: "missing" | "invalid" };

export interface ServiceAuthConfig {
  /** The service doing the checking; tokens addressed elsewhere are refused. */
  audience: ServiceAudience;
  /** Its public key set (WS_SERVICE_JWKS, REST_API_SERVICE_JWKS, ...), parsed by the app's env schema. */
  jwks?: { keys: ServiceJwk[] };
}

export interface ServiceAuth {
  /** False when this environment has no service keys, so no action can be authorized. */
  configured(scope: ServiceScope): boolean;
  /** Checks `Authorization: Bearer <service token>` for one action. Never throws. */
  authorize(header: string | null | undefined, scope: ServiceScope): Promise<ServiceAuthResult>;
}

export function createServiceAuth(config: ServiceAuthConfig): ServiceAuth {
  const verify = config.jwks ? createServiceTokenVerifier(config.jwks, config.audience) : null;

  return {
    configured: () => verify !== null,

    async authorize(header, scope) {
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
