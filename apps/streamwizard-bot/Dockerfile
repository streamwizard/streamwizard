FROM oven/bun:1.3.14

# This Dockerfile expects the Docker build context to be the repository root.
# Dokploy settings:
# - Docker File: apps/streamwizard-bot/Dockerfile
# - Docker Context Path: .
WORKDIR /app

# Install Doppler CLI via official package repo
RUN apt-get update && apt-get install -y apt-transport-https ca-certificates curl gnupg && \
    curl -sLf --retry 3 --tlsv1.2 --proto "=https" 'https://packages.doppler.com/public/cli/gpg.DE2A7741A397C129.key' | gpg --dearmor -o /usr/share/keyrings/doppler-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/doppler-archive-keyring.gpg] https://packages.doppler.com/public/cli/deb/debian any-version main" | tee /etc/apt/sources.list.d/doppler-cli.list && \
    apt-get update && apt-get -y install doppler && \
    rm -rf /var/lib/apt/lists/*

COPY . .
RUN bun install --frozen-lockfile --production

WORKDIR /app/apps/streamwizard-bot

# DOPPLER_TOKEN must be set in Dokploy's Environment Variables section at runtime
ENTRYPOINT ["doppler", "run", "--"]
CMD ["bun", "run", "start"]
