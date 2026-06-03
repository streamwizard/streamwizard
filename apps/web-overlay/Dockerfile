# ============================================
# Stage 1: Dependencies
# ============================================
FROM oven/bun:1.3.12 AS dependencies

WORKDIR /app

# Root workspace config
COPY package.json bun.lock* turbo.json ./

# All workspace package.json files so Bun can resolve workspace:* deps
COPY packages/eslint-config/package.json     ./packages/eslint-config/
COPY packages/logger/package.json            ./packages/logger/
COPY packages/metrics/package.json           ./packages/metrics/
COPY packages/posthog/package.json           ./packages/posthog/
COPY packages/schemas/package.json           ./packages/schemas/
COPY packages/sentry/package.json            ./packages/sentry/
COPY packages/supabase/package.json          ./packages/supabase/
COPY packages/twitch-api/package.json        ./packages/twitch-api/
COPY packages/twitch-eventsub/package.json   ./packages/twitch-eventsub/
COPY packages/types/package.json             ./packages/types/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/ui/package.json                ./packages/ui/

# App package.json files
COPY apps/web-monitor/package.json      ./apps/web-monitor/
COPY apps/web-streamwizard/package.json ./apps/web-streamwizard/
COPY apps/rest-api/package.json         ./apps/rest-api/
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

COPY . .
COPY --from=dependencies /app/node_modules ./node_modules

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# Install Doppler CLI via official package repo (also installs ca-certificates)
RUN apt-get update && apt-get install -y apt-transport-https ca-certificates curl gnupg && \
    curl -sLf --retry 3 --tlsv1.2 --proto "=https" 'https://packages.doppler.com/public/cli/gpg.DE2A7741A397C129.key' | gpg --dearmor -o /usr/share/keyrings/doppler-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/doppler-archive-keyring.gpg] https://packages.doppler.com/public/cli/deb/debian any-version main" | tee /etc/apt/sources.list.d/doppler-cli.list && \
    apt-get update && \
    apt-get -y install doppler && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=true

ARG DOPPLER_TOKEN

WORKDIR /app/apps/web-overlay
RUN doppler run --token "$DOPPLER_TOKEN" -- bun run build

# ============================================
# Stage 3: Runner
# ============================================
FROM oven/bun:1.3.12 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Install Doppler CLI via official package repo
RUN apt-get update && apt-get install -y apt-transport-https ca-certificates curl gnupg && \
    curl -sLf --retry 3 --tlsv1.2 --proto "=https" 'https://packages.doppler.com/public/cli/gpg.DE2A7741A397C129.key' | gpg --dearmor -o /usr/share/keyrings/doppler-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/doppler-archive-keyring.gpg] https://packages.doppler.com/public/cli/deb/debian any-version main" | tee /etc/apt/sources.list.d/doppler-cli.list && \
    apt-get update && \
    apt-get -y install doppler && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=bun:bun /app/apps/web-overlay/public ./apps/web-overlay/public
COPY --from=builder --chown=bun:bun /app/apps/web-overlay/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/apps/web-overlay/.next/static ./apps/web-overlay/.next/static

USER bun

EXPOSE 3000

# DOPPLER_TOKEN must be set in Dokploy's Environment Variables section at runtime
ENTRYPOINT ["doppler", "run", "--"]
CMD ["bun", "apps/web-overlay/server.js"]
