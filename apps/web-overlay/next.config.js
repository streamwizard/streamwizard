const fs = require("fs");
const path = require("path");

/** Monorepo root (primary lockfile) — clears Turbopack multi-lockfile root warning */
const turbopackRoot = path.resolve(__dirname, "../..");

/**
 * Hydrate `process.env` from the repo root `.env*` (same semantics as `packages/env/src/index.ts`).
 * Bun and some workspaces do not resolve `@next/env` from `next.config.js`; keep this loader dependency-free.
 */
function loadDotenvFilesIntoProcessEnv(fromDir) {
  const parseEnvContent = (envContent) => {
    envContent.split("\n").forEach((line) => {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith("#")) return;

      const normalizedLine = trimmedLine.startsWith("export ")
        ? trimmedLine.slice(7)
        : trimmedLine;

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

/** @type {import('next').NextConfig} */
const nextConfig = {
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

module.exports = nextConfig;


// next.config.js
module.exports = {
  allowedDevOrigins: ['10.10.10.*'],
}