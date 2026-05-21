FROM oven/bun:1.3.5-alpine

# This Dockerfile expects the Docker build context to be the repository root.
# Dokploy settings:
# - Docker File: apps/streamwizard-bot/Dockerfile
# - Docker Context Path: .
WORKDIR /app

# Install Doppler CLI via official Alpine package repo
RUN wget -q -t3 'https://packages.doppler.com/public/cli/rsa.F35A1B29A6E22E17.key' -O /etc/apk/keys/cli@doppler-F35A1B29A6E22E17.rsa.pub && \
    echo 'https://packages.doppler.com/public/cli/alpine/any-version/main' | tee -a /etc/apk/repositories && \
    apk update && apk add doppler

COPY . .
RUN bun install --frozen-lockfile --production

WORKDIR /app/apps/streamwizard-bot

# DOPPLER_TOKEN must be set in Dokploy's Environment Variables section at runtime
ENTRYPOINT ["doppler", "run", "--"]
CMD ["bun", "run", "start"]
