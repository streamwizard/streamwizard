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
