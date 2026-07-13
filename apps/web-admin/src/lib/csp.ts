// Built per-request in src/proxy.ts so script-src can carry a fresh nonce —
// Next.js reads the nonce from the request's Content-Security-Policy header
// and stamps it on its inline (hydration/RSC) scripts, which is what lets us
// drop 'unsafe-inline' from script-src.
export function buildCsp(nonce: string): string {
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  // Supabase realtime uses WebSocket — derive wss:// from the https:// URL
  const supabaseWs = supabaseUrl.replace(/^https:\/\//, "wss://");
  const wsServerUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? process.env.WS_SERVER_URL ?? "";

  const directives: string[] = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    // Next.js inlines critical styles
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data:",
    // Sentry is tunneled through /monitoring so 'self' covers it; the ws
    // topology/live pages open a WebSocket straight to ws-server.
    [
      "connect-src 'self'",
      supabaseUrl,
      supabaseWs,
      wsServerUrl,
    ]
      .filter(Boolean)
      .join(" "),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Internal tool — nothing should ever embed it.
    "frame-ancestors 'none'",
  ];

  // Local dev sends this policy as report-only (see src/proxy.ts), so plain
  // http/ws targets like local Supabase and ws-server still work there.
  directives.push("upgrade-insecure-requests");

  return directives.join("; ");
}
