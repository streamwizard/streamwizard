# ============================================
# Stage 1: Dependencies
# ============================================
FROM oven/bun:1 AS dependencies

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

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# ============================================
# Stage 2: Build
# ============================================
FROM oven/bun:1 AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules

# Copy all source files
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build only the web-streamwizard app via Turborepo
RUN bun x turbo run build --filter=@repo/web-streamwizard

# ============================================
# Stage 3: Runner
# ============================================
FROM oven/bun:1 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Standalone output is at apps/web-streamwizard/.next/standalone when building from monorepo root
COPY --from=builder --chown=bun:bun /app/apps/web-streamwizard/public ./public
COPY --from=builder --chown=bun:bun /app/apps/web-streamwizard/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/apps/web-streamwizard/.next/static ./.next/static

USER bun

EXPOSE 3000

CMD ["bun", "server.js"]
