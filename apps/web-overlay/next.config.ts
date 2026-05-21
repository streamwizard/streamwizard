import "./src/lib/env";
import fs from "fs";
import path from "path";
import type { NextConfig } from "next";

/** Monorepo root (primary lockfile) — clears Turbopack multi-lockfile root warning */
const turbopackRoot = path.resolve(__dirname, "../..");

function loadDotenvFilesIntoProcessEnv(fromDir: string) {
  const parseEnvContent = (envContent: string) => {
    envContent.split("\n").forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith("#")) return;
      const normalizedLine = trimmedLine.startsWith("export ") ? trimmedLine.slice(7) : trimmedLine;
      const [key, ...valueParts] = normalizedLine.split("=");
      if (key && valueParts.length > 0) {
        const rawValue = valueParts.join("=").trim();
        const value = rawValue.replace(/^["']|["']$/g, "");
        const envKey = key.trim();
        if (!process.env[envKey]) {
          process.env[envKey] = value;
        }
      }
    });
  };

  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(fromDir, fileName);
    if (!fs.existsSync(filePath)) continue;
    parseEnvContent(fs.readFileSync(filePath, "utf8"));
  }
}

loadDotenvFilesIntoProcessEnv(turbopackRoot);

const wsServerUrl = process.env.WS_SERVER_URL ?? "";

/** OBS-friendly fonts CSP for the overlay scene viewer (optional hardening). */
const overlaySceneFontsCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: data:",
  `connect-src 'self'${wsServerUrl ? ` ${wsServerUrl}` : ""}`,
].join("; ");

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_PUBLIC_KEY ?? "",
    NEXT_PUBLIC_WS_SERVER_URL: wsServerUrl,
  },
  transpilePackages: ["@t3-oss/env-nextjs", "@t3-oss/env-core"],
  turbopack: {
    root: turbopackRoot,
  },
  reactCompiler: true,
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:overlayId",
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
