#!/bin/sh
# One-shot provisioning for the monitoring VPS (Ubuntu 24.04). Idempotent —
# safe to re-run. Needs root: sudo sh provision.sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root: sudo sh $0" >&2
  exit 1
fi

echo "== Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
# Let the streamwizard user run compose without sudo.
usermod -aG docker streamwizard

echo "== Tailscale"
if ! command -v tailscale >/dev/null 2>&1; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi
systemctl enable --now tailscaled

echo "== Firewall (ufw)"
# 80/443 for Caddy; SSH stays open until tailnet SSH is confirmed working —
# tighten to the tailscale interface afterwards if desired.
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow in on tailscale0
ufw --force enable

echo "== Done"
echo "next: tailscale up (or: tailscale up --auth-key=<key>)"
echo "then, as streamwizard: cd ~/streamwizard/docker/monitor-vps && cp .env.example .env && docker compose up --build -d"
