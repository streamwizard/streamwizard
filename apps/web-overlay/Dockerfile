# This Dockerfile expects the Docker build context to be the repository root.
# Dokploy settings:
# - Docker File: apps/web-overlay/Dockerfile
# - Docker Context Path: .

# ============================================
# Stage 1: Build
# ============================================
# Copy the whole monorepo and install with the frozen lockfile. Copying the
# full repo (instead of enumerating every workspace package.json) keeps this
# resilient when apps or packages are added — no Dockerfile edits required.
FROM oven/bun:1.3.12 AS builder

WORKDIR /app

COPY . .
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
# Stage 2: Runner
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
