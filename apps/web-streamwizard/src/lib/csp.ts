// Built per-request in src/proxy.ts so script-src can carry a fresh nonce —
// Next.js reads the nonce from the request's Content-Security-Policy header
// and stamps it on its inline (hydration/RSC) scripts, which is what lets us
// drop 'unsafe-inline' from script-src.
export function buildCsp(nonce: string): string {
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  // Supabase realtime uses WebSocket — derive wss:// from the https:// URL
  const supabaseWs = supabaseUrl.replace(/^https:\/\//, "wss://");
  const wsServerUrl = process.env.WS_SERVER_URL ?? "";

  const directives: string[] = [
    "default-src 'self'",
    // Inline scripts must carry the per-request nonce. Monaco Editor requires
    // unsafe-eval for its language service workers and loads its core files
    // from jsdelivr CDN (no custom loader is configured). player.twitch.tv is
    // needed for the Twitch embedded player script.
    `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' https://player.twitch.tv https://cdn.jsdelivr.net`,
    // Monaco Editor spawns language workers via blob: URLs
    "worker-src blob:",
    // Next.js inlines critical styles; Google Fonts and Monaco (via jsdelivr) load external stylesheets
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    // Google Fonts actual font files
    "font-src 'self' https://fonts.gstatic.com",
    // Twitch CDN images + our own R2 CDN (e.g. error page gifs) + data URIs used by the UI
    `img-src 'self' data: https://static-cdn.jtvnw.net https://vod-secure.twitch.tv https://clips-media-assets2.twitch.tv ${process.env.NEXT_PUBLIC_CDN_URL}`,
    // R2 CDN for video assets (light mode transition WebM, future overlay assets)
    `media-src 'self' ${process.env.NEXT_PUBLIC_CDN_URL}`,
    // PostHog and Sentry are proxied through /ingest and /monitoring so 'self' covers them.
    // Monaco fetches worker scripts and additional resources from jsdelivr CDN.
    [
      "connect-src 'self'",
      supabaseUrl,
      supabaseWs,
      wsServerUrl,
      "https://cdn.jsdelivr.net",
      // Cloud OBS nodes (noVNC viewer, obs-websocket controls, and the
      // obs-instance-manager metrics/REST endpoints) are provisioned
      // dynamically, so they're addressed as *.streamwizard.org subdomains
      // rather than fixed hosts. Single-label names only — Cloudflare
      // Universal SSL covers just one subdomain level.
      "wss://*.streamwizard.org",
      "https://*.streamwizard.org",
    ]
      .filter(Boolean)
      .join(" "),
    // Twitch embedded player and clips use iframes served from these origins
    "frame-src https://player.twitch.tv https://clips.twitch.tv",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  // Local dev sends this policy as report-only (see src/proxy.ts), so plain
  // http/ws targets like local Supabase and test nodes still work there.
  directives.push("upgrade-insecure-requests");

  return directives.join("; ");
}
