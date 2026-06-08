import "./src/lib/env";
import { withSentryConfig } from "@sentry/nextjs";

function buildCsp(): string {
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  // Supabase realtime uses WebSocket — derive wss:// from the https:// URL
  const supabaseWs = supabaseUrl.replace(/^https:\/\//, "wss://");
  const wsServerUrl = process.env.WS_SERVER_URL ?? "";

  const directives: string[] = [
    "default-src 'self'",
    // Next.js App Router inlines hydration scripts; unsafe-inline is required unless nonces are wired up
    "script-src 'self' 'unsafe-inline'",
    // Next.js inlines critical styles; Google Fonts stylesheet is fetched at runtime
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // Google Fonts actual font files
    "font-src 'self' https://fonts.gstatic.com",
    // Twitch CDN images + data URIs used by the UI
    "img-src 'self' data: https://static-cdn.jtvnw.net https://vod-secure.twitch.tv",
    // PostHog and Sentry are proxied through /ingest and /monitoring so 'self' covers them
    [
      "connect-src 'self'",
      supabaseUrl,
      supabaseWs,
      wsServerUrl,
    ]
      .filter(Boolean)
      .join(" "),
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ];

  return directives.join("; ");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
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
    ],
  },
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
});
