FROM oven/bun:1.3.5-alpine

# This Dockerfile expects the Docker build context to be the repository root.
# Dokploy settings:
# - Docker File: apps/streamwizard-bot/Dockerfile
# - Docker Context Path: .
WORKDIR /app

COPY . .
RUN bun install --frozen-lockfile --production

WORKDIR /app/apps/streamwizard-bot
CMD ["bun", "run", "start"]
