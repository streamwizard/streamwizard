export type CspOptions = {
  // Monaco Editor (only the widget editor route loads it) needs 'unsafe-eval'
  // for its language services, pulls core files + workers from jsdelivr, and
  // spawns workers via blob: URLs. Those are the weakest directives in the
  // policy, so we grant them per-route instead of to every page. See src/proxy.ts.
  monaco?: boolean;
  // Staging sits behind Cloudflare Access. When the Access session cookie is
  // missing/expired, a same-origin fetch (e.g. the /deck manifest link) gets
  // redirected to Access's own login page on streamwizard.cloudflareaccess.com
  // instead of the resource. Without this, that redirect target isn't an
  // allowed source anywhere, so default-src blocks it outright and the user
  // never gets the chance to reauth. Production has no Access in front of it,
  // so this is staging-only. See src/proxy.ts.
  cloudflareAccess?: boolean;
};

// Built per-request in src/proxy.ts so script-src can carry a fresh nonce —
// Next.js reads the nonce from the request's Content-Security-Policy header
// and stamps it on its inline (hydration/RSC) scripts, which is what lets us
// drop 'unsafe-inline' from script-src.
export function buildCsp(nonce: string, options: CspOptions = {}): string {
  const { monaco = false, cloudflareAccess = false } = options;
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  // Supabase realtime uses WebSocket — derive wss:// from the https:// URL
  const supabaseWs = supabaseUrl.replace(/^https:\/\//, "wss://");
  const wsServerUrl = process.env.WS_SERVER_URL ?? "";

  const directives: string[] = [
    "default-src 'self'",
    // Inline scripts must carry the per-request nonce. player.twitch.tv is
    // needed for the Twitch embedded player script. Monaco's 'unsafe-eval' +
    // jsdelivr are added only on the editor route (see monaco option).
    [
      "script-src 'self'",
      `'nonce-${nonce}'`,
      "https://player.twitch.tv",
      ...(monaco ? ["'unsafe-eval'", "https://cdn.jsdelivr.net"] : []),
    ].join(" "),
    // Next.js inlines critical styles; Google Fonts load external stylesheets.
    // Monaco (via jsdelivr) loads external stylesheets only on the editor route.
    [
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      ...(monaco ? ["https://cdn.jsdelivr.net"] : []),
    ].join(" "),
    // Google Fonts actual font files
    "font-src 'self' https://fonts.gstatic.com",
    // Twitch CDN images + our own R2 CDN (e.g. error page gifs) + data URIs used by the UI
    [
      "img-src 'self' data: https://static-cdn.jtvnw.net https://vod-secure.twitch.tv https://clips-media-assets2.twitch.tv",
      process.env.NEXT_PUBLIC_CDN_URL,
    ]
      .filter(Boolean)
      .join(" "),
    // R2 CDN for video assets (light mode transition WebM, future overlay assets)
    ["media-src 'self'", process.env.NEXT_PUBLIC_CDN_URL].filter(Boolean).join(" "),
    // PostHog and Sentry are proxied through /ingest and /monitoring so 'self' covers them.
    // Monaco fetches worker scripts and additional resources from jsdelivr CDN.
    [
      "connect-src 'self'",
      supabaseUrl,
      supabaseWs,
      wsServerUrl,
      ...(monaco ? ["https://cdn.jsdelivr.net"] : []),
      // Cloud OBS nodes (noVNC viewer, obs-websocket controls, and the
      // obs-instance-manager metrics/REST endpoints) are provisioned
      // dynamically, so they're addressed as *.streamwizard.org subdomains
      // rather than fixed hosts. Single-label names only — Cloudflare
      // Universal SSL covers just one subdomain level.
      "wss://*.streamwizard.org",
      "https://*.streamwizard.org",
      // Custom-widget previews render in srcdoc iframes, which inherit this
      // policy: widgets fetch state from the overlay app and call the weather
      // and geocoding APIs (see buildWidgetSrcdoc in @repo/ui).
      process.env.NEXT_PUBLIC_OVERLAY_URL,
      "https://api.open-meteo.com",
      "https://nominatim.openstreetmap.org",
    ]
      .filter(Boolean)
      .join(" "),
    // Twitch embedded player and clips use iframes served from these origins
    "frame-src https://player.twitch.tv https://clips.twitch.tv",
    // Explicit manifest-src (rather than relying on the default-src fallback)
    // so we can carve out the Cloudflare Access reauth redirect on staging
    // without loosening default-src for everything else.
    [
      "manifest-src 'self'",
      ...(cloudflareAccess ? ["https://streamwizard.cloudflareaccess.com"] : []),
    ].join(" "),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Modern replacement for the X-Frame-Options: DENY set in next.config.ts;
    // both are kept so older browsers stay covered.
    "frame-ancestors 'none'",
  ];

  // Monaco Editor spawns language workers via blob: URLs — editor route only.
  if (monaco) {
    directives.push("worker-src blob:");
  }

  // Local dev sends this policy as report-only (see src/proxy.ts), so plain
  // http/ws targets like local Supabase and test nodes still work there.
  directives.push("upgrade-insecure-requests");

  return directives.join("; ");
}
