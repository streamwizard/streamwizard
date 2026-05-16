# ============================================
# Stage 1: Dependencies
# ============================================
FROM oven/bun:1.3.12 AS dependencies

WORKDIR /app

# Root workspace config
COPY package.json bun.lock* turbo.json ./

# All workspace package.json files so Bun can resolve workspace:* deps
COPY packages/env/package.json             ./packages/env/
COPY packages/eslint-config/package.json   ./packages/eslint-config/
COPY packages/logger/package.json          ./packages/logger/
COPY packages/metrics/package.json         ./packages/metrics/
COPY packages/schemas/package.json         ./packages/schemas/
COPY packages/supabase/package.json        ./packages/supabase/
COPY packages/twitch-api/package.json      ./packages/twitch-api/
COPY packages/twitch-eventsub/package.json ./packages/twitch-eventsub/
COPY packages/types/package.json           ./packages/types/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/ui/package.json              ./packages/ui/

# App package.json files
COPY apps/web-streamwizard/package.json ./apps/web-streamwizard/
COPY apps/clip-sync/package.json        ./apps/clip-sync/
COPY apps/discord-bot/package.json      ./apps/discord-bot/
COPY apps/rest-api/package.json         ./apps/rest-api/
COPY apps/smp-bridge/package.json       ./apps/smp-bridge/
COPY apps/streamwizard-bot/package.json ./apps/streamwizard-bot/
COPY apps/web-overlay/package.json      ./apps/web-overlay/
COPY apps/ws-server/package.json        ./apps/ws-server/

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# ============================================
# Stage 2: Build
# ============================================
FROM oven/bun:1.3.12 AS builder

WORKDIR /app

# Copy all source files first
COPY . .

# Seed root node_modules from the deps stage so bun install is fast (no re-download)
COPY --from=dependencies /app/node_modules ./node_modules

# Run install to materialise workspace-local node_modules (e.g. packages/ui/node_modules,
# apps/web-streamwizard/node_modules) that were not captured by the root copy above.
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run next build from the app directory so bun resolves binaries from the local node_modules
WORKDIR /app/apps/web-streamwizard
RUN bun run build

# ============================================
# Stage 3: Runner
# ============================================
FROM oven/bun:1.3.12 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# In a monorepo build the standalone output nests under apps/web-streamwizard/
COPY --from=builder --chown=bun:bun /app/apps/web-streamwizard/public ./apps/web-streamwizard/public
COPY --from=builder --chown=bun:bun /app/apps/web-streamwizard/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/apps/web-streamwizard/.next/static ./apps/web-streamwizard/.next/static

USER bun

EXPOSE 3000

CMD ["bun", "apps/web-streamwizard/server.js"]
