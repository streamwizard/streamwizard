import "./src/lib/env";
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  output: "standalone",
  transpilePackages: ["@t3-oss/env-nextjs", "@t3-oss/env-core"],
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_PUBLIC_KEY ?? "",
    NEXT_PUBLIC_WS_SERVER_URL: process.env.WS_SERVER_URL ?? "",
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

export default nextConfig;
/*
export default withSentryConfig(nextConfig, {
  ...
});
*/
