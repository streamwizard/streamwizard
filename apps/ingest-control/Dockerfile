# This Dockerfile expects the Docker build context to be the repository root.
# Runs on the dedicated stream box via docker/stream-server/docker-compose.yml
# (NOT Dokploy). The container needs the host Docker socket mounted at
# /var/run/docker.sock so it can provision per-streamer OBS containers.

# ============================================
# Stage 1: Dependencies
# ============================================
# Copy the whole monorepo and install with the frozen lockfile. Copying the
# full repo (instead of enumerating every workspace package.json) keeps this
# resilient when apps or packages are added — no Dockerfile edits required.
# Note: do NOT pass --production here. Combined with --frozen-lockfile, Bun
# re-resolves the tree without devDependencies, which no longer matches the
# committed lockfile and fails with "lockfile had changes, but lockfile is frozen".
FROM oven/bun:1.3.12 AS deps

WORKDIR /app

COPY . .
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# ============================================
# Stage 2: Runner
# ============================================
FROM oven/bun:1.3.12 AS runner

WORKDIR /app

# Install Doppler CLI via official package repo
RUN apt-get update && apt-get install -y apt-transport-https ca-certificates curl gnupg && \
    curl -sLf --retry 3 --tlsv1.2 --proto "=https" 'https://packages.doppler.com/public/cli/gpg.DE2A7741A397C129.key' | gpg --dearmor -o /usr/share/keyrings/doppler-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/doppler-archive-keyring.gpg] https://packages.doppler.com/public/cli/deb/debian any-version main" | tee /etc/apt/sources.list.d/doppler-cli.list && \
    apt-get update && apt-get -y install doppler && \
    rm -rf /var/lib/apt/lists/*

# Everything is copied from the deps stage (not the build context) so the
# installed node_modules survive — Bun keeps workspace symlinks and per-app
# dependencies in each package's/app's local node_modules, and .dockerignore
# would otherwise strip them from a build-context copy.

# Hoisted dependencies + workspace root marker
COPY --from=deps --chown=bun:bun /app/node_modules ./node_modules
COPY --from=deps --chown=bun:bun /app/package.json ./

# All shared packages (with their node_modules) — apps import these at runtime
COPY --from=deps --chown=bun:bun /app/packages ./packages

# Only this app (with its node_modules) — not the other apps
COPY --from=deps --chown=bun:bun /app/apps/ingest-control ./apps/ingest-control

WORKDIR /app/apps/ingest-control

USER bun

# DOPPLER_TOKEN must be set in the compose env at runtime
ENTRYPOINT ["doppler", "run", "--"]
CMD ["bun", "run", "start"]
