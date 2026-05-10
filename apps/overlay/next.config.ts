import type { NextConfig } from "next";

/** OBS-friendly fonts CSP for the overlay scene viewer (optional hardening). */
const overlaySceneFontsCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: data:",
  "connect-src 'self'",
].join("; ");

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  output: "standalone",
  async headers() {
    return [
      {
        source: "/overlay/:overlayId",
        headers: [
          {
            key: "Content-Security-Policy",
            value: overlaySceneFontsCsp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
