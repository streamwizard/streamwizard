FROM oven/bun:1.3.5-alpine

# This Dockerfile expects the Docker build context to be the repository root.
# Dokploy settings:
# - Docker File: apps/smp-bridge/Dockerfile
# - Docker Context Path: .
WORKDIR /app

# Copy manifests first so dependency install can be cached.
COPY package.json bun.lock ./
COPY apps/smp-bridge/package.json apps/smp-bridge/package.json
COPY packages ./packages

# Install only this app workspace and its transitive workspace dependencies.
RUN bun install --frozen-lockfile --production --filter @repo/smp-bridge

# Copy the rest of the repository after dependencies are installed.
COPY . .

WORKDIR /app/apps/smp-bridge
CMD ["bun", "run", "start"]
