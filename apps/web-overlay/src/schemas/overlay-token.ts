import { z } from "zod";

/**
 * A scene's subscriber_token: 32 random bytes as 64 lowercase hex characters.
 * The overlay's own credential for its server actions and `/api/*` routes.
 */
export const OVERLAY_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export const overlayTokenSchema = z.string().regex(OVERLAY_TOKEN_PATTERN);
