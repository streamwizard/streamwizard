import { createServiceAuth } from "@repo/service-token";
import { env } from "@/lib/env";

// Who may call ws-server's server-to-server surface, and for what. Each of our
// services signs a 60-second token per action (@repo/service-token); the
// public keys and the service each one belongs to come from WS_SERVICE_JWKS.
// There is no shared secret: without WS_SERVICE_JWKS nothing gets in.

const serviceAuth = createServiceAuth({ audience: "ws-server", jwks: env.WS_SERVICE_JWKS });

export const serviceAuthConfigured = serviceAuth.configured;
export const authorizeService = serviceAuth.authorize;
