FROM oven/bun:1.3.12-alpine

# This Dockerfile expects the Docker build context to be the repository root.
# Dokploy settings:
# - Docker File: apps/ws-server/Dockerfile
# - Docker Context Path: .
#
# Cloudflare DNS note: point the ws-server subdomain with "DNS only" (grey cloud),
# NOT proxied, to avoid Cloudflare's 100 s WebSocket idle timeout on free/pro plans.
WORKDIR /app

COPY . .
RUN bun install --frozen-lockfile --production

WORKDIR /app/apps/ws-server
EXPOSE 8000
CMD ["bun", "run", "start"]
