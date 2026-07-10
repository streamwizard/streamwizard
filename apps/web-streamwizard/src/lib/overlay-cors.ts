import { type NextRequest } from "next/server";

// The public overlay APIs are only consumed cross-origin by the overlay app
// (OBS browser sources load it from NEXT_PUBLIC_OVERLAY_URL). The scene slug
// acts as a bearer capability, so echoing an allowlisted Origin instead of
// "*" keeps other websites from reading overlay config with a leaked slug.
// Same-origin requests (dashboard previews) never need CORS headers.
const ALLOWED_ORIGINS = new Set([process.env.NEXT_PUBLIC_OVERLAY_URL].filter(Boolean));

export function overlayCorsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}
