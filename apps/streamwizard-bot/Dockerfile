FROM oven/bun:1.3.5-alpine

# This Dockerfile expects the build context to be the repository root.
WORKDIR /app

COPY . .
RUN bun install --frozen-lockfile --production

WORKDIR /app/apps/streamwizard-bot
CMD ["bun", "run", "start"]
