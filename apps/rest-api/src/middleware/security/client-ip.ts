// middleware/security/client-ip.ts
import type { Context } from "hono";
import { getConnInfo } from "hono/bun";

/**
 * The client's IP, for lockouts, allowlists and security logs.
 *
 * Production traffic arrives as Cloudflare -> Traefik -> rest-api. Traefik has
 * no forwardedHeaders.trustedIPs, so it replaces X-Forwarded-For and X-Real-IP
 * with the address it was connected from: a Cloudflare edge, shared by every
 * visitor routed through it. Keying on those let one caller lock out everyone
 * on the same edge (SW-482). Before Traefik's rewrite they were also whatever
 * the client sent.
 *
 * Cloudflare puts the visitor's address in CF-Connecting-IP and overwrites any
 * value the client sent. That only holds while the origin can't be reached
 * except through Cloudflare, which is how production is set up.
 *
 * Without the header (local dev, calls between containers) this falls back to
 * the socket address.
 */
export function clientIp(c: Context): string {
  const cloudflare = c.req.header("cf-connecting-ip")?.trim();
  if (cloudflare) return cloudflare;
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    // Not served by Bun.serve (tests, app.request): no socket to read.
    return "unknown";
  }
}
