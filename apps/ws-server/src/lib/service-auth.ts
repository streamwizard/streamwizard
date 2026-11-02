import { createServiceTokenVerifier, looksLikeJwt, type ServiceJwk, type ServiceScope } from "@repo/service-token";
import { isValidSecret } from "./secret";
import { env } from "./env";

// Who may call ws-server's server-to-server surface, and for what. Each of our
// services signs a 60-second token per action (@repo/service-token); the
// public keys and the service each one belongs to come from WS_SERVICE_JWKS.
// The old shared secrets still work until WS_SERVICE_AUTH_REQUIRED is on, so
// an environment can move over one service at a time.

export type ServiceAuthResult =
  | { ok: true; service: string; legacy: boolean }
  | { ok: false; reason: "missing" | "invalid" };

export interface ServiceAuthConfig {
  /** WS_SERVICE_JWKS, parsed. */
  jwks?: { keys: ServiceJwk[] };
  /** WS_SERVICE_AUTH_REQUIRED: refuse the legacy secrets. */
  required: boolean;
  /** Legacy secret for broadcast, revoke and consumer. */
  consumerSecret?: string;
  /** Legacy secret for bot sockets (the Supabase service-role key). */
  botSecret?: string;
}

export function createServiceAuth(config: ServiceAuthConfig) {
  const verify = config.jwks ? createServiceTokenVerifier(config.jwks) : null;
  const legacySecretFor = (scope: ServiceScope) => (scope === "bot" ? config.botSecret : config.consumerSecret);

  return {
    /** False when this environment has no way at all to authorize this action. */
    configured(scope: ServiceScope): boolean {
      return verify !== null || (!config.required && legacySecretFor(scope) !== undefined);
    },

    /** Checks `Authorization: Bearer …` for one action. Never throws. */
    async authorize(header: string | null, scope: ServiceScope): Promise<ServiceAuthResult> {
      const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
      if (!token) return { ok: false, reason: "missing" };

      if (verify && looksLikeJwt(token)) {
        try {
          return { ok: true, service: await verify(token, scope), legacy: false };
        } catch {
          return { ok: false, reason: "invalid" };
        }
      }

      const legacy = legacySecretFor(scope);
      if (!config.required && legacy && isValidSecret(token, legacy)) {
        return { ok: true, service: "legacy", legacy: true };
      }
      return { ok: false, reason: "invalid" };
    },
  };
}

const serviceAuth = createServiceAuth({
  jwks: env.WS_SERVICE_JWKS ? (JSON.parse(env.WS_SERVICE_JWKS) as { keys: ServiceJwk[] }) : undefined,
  required: env.WS_SERVICE_AUTH_REQUIRED,
  consumerSecret: env.CONSUMER_SECRET,
  botSecret: env.SUPABASE_SECRET_KEY,
});

export const serviceAuthConfigured = serviceAuth.configured;
export const authorizeService = serviceAuth.authorize;
