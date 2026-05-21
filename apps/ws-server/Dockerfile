FROM oven/bun:1.3.12-alpine

# This Dockerfile expects the Docker build context to be the repository root.
# Dokploy settings:
# - Docker File: apps/ws-server/Dockerfile
# - Docker Context Path: .
#
# Cloudflare DNS note: point the ws-server subdomain with "DNS only" (grey cloud),
# NOT proxied, to avoid Cloudflare's 100 s WebSocket idle timeout on free/pro plans.
WORKDIR /app

# Install Doppler CLI via official Alpine package repo
RUN wget -q -t3 'https://packages.doppler.com/public/cli/rsa.F35A1B29A6E22E17.key' -O /etc/apk/keys/cli@doppler-F35A1B29A6E22E17.rsa.pub && \
    echo 'https://packages.doppler.com/public/cli/alpine/any-version/main' | tee -a /etc/apk/repositories && \
    apk update && apk add doppler

COPY . .
RUN bun install --frozen-lockfile --production

WORKDIR /app/apps/ws-server

EXPOSE 8000

# DOPPLER_TOKEN must be set in Dokploy's Environment Variables section at runtime
ENTRYPOINT ["doppler", "run", "--"]
CMD ["bun", "run", "start"]
