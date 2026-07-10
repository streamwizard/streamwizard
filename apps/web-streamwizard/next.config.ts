import "./src/lib/env";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

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
          // Content-Security-Policy is set per-request in src/proxy.ts so
          // script-src can carry a nonce instead of 'unsafe-inline'.
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
      ...(process.env.NEXT_PUBLIC_CDN_URL
        ? [
            {
              protocol: "https" as const,
              hostname: new URL(process.env.NEXT_PUBLIC_CDN_URL).hostname,
            },
          ]
        : []),
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
