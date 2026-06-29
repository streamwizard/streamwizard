import "./src/lib/env";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

function buildCsp(): string {
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  // Supabase realtime uses WebSocket — derive wss:// from the https:// URL
  const supabaseWs = supabaseUrl.replace(/^https:\/\//, "wss://");
  const wsServerUrl = process.env.WS_SERVER_URL ?? "";

  const directives: string[] = [
    "default-src 'self'",
    // Next.js App Router requires unsafe-inline for hydration scripts.
    // Monaco Editor requires unsafe-eval for its language service workers and
    // loads its core files from jsdelivr CDN (no custom loader is configured).
    // player.twitch.tv is needed for the Twitch embedded player script.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://player.twitch.tv https://cdn.jsdelivr.net",
    // Monaco Editor spawns language workers via blob: URLs
    "worker-src blob:",
    // Next.js inlines critical styles; Google Fonts and Monaco (via jsdelivr) load external stylesheets
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    // Google Fonts actual font files
    "font-src 'self' https://fonts.gstatic.com",
    // Twitch CDN images + data URIs used by the UI
    "img-src 'self' data: https://static-cdn.jtvnw.net https://vod-secure.twitch.tv https://clips-media-assets2.twitch.tv",
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
      // Cloud OBS noVNC viewer and obs-websocket controls — connect directly
      // to the stream-server's OBS container (TODO: hardcoded test IP).
      "ws://10.10.10.185:6080",
      "ws://10.10.10.185:4455",
      // Admin node metrics panel connects directly to obs-instance-manager's
      // /admin/metrics/stream on the node host, and the admin nodes page
      // also POSTs directly to its REST API to create test instances
      // (TODO: hardcoded test IP).
      "ws://10.10.10.185:3000",
      "http://10.10.10.185:3000",

    ]
      .filter(Boolean)
      .join(" "),
    // Twitch embedded player and clips use iframes served from these origins
    "frame-src https://player.twitch.tv https://clips.twitch.tv",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  // upgrade-insecure-requests would force the Cloud OBS noVNC ws:// connection
  // to wss://, which the plain-ws websockify on the OBS container can't speak.
  // TODO: drop this guard once the OBS container is fronted by TLS.
  if (process.env.NODE_ENV === "production") {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Allows accessing the dev server (and its HMR websocket) from the LAN IP
  // in addition to localhost/127.0.0.1, e.g. when testing from another device.
  allowedDevOrigins: ["127.0.0.1", "10.10.10.73"],
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  output: "standalone",
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: buildCsp() },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://eu-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  transpilePackages: ["@t3-oss/env-nextjs", "@t3-oss/env-core"],
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_PUBLIC_KEY ?? "",
    NEXT_PUBLIC_WS_SERVER_URL: process.env.WS_SERVER_URL ?? "",
    NEXT_PUBLIC_SENTRY_DSN: process.env.SENTRY_DSN ?? "",
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? process.env.POSTHOG_KEY ?? "",
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static-cdn.jtvnw.net",
      },
      {
        protocol: "https",
        hostname: "vod-secure.twitch.tv",
      },
      {
        protocol: "https",
        hostname: "clips-media-assets2.twitch.tv",
      },
    ],
  },
};

export default process.env.NODE_ENV === "development"
  ? nextConfig
  : withSentryConfig(nextConfig, {
      silent: !process.env.CI,
      widenClientFileUpload: true,
      tunnelRoute: "/monitoring",
    });
