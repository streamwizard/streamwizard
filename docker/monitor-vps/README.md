# Monitoring VPS

Deploys the StreamWizard monitoring stack on a **small dedicated VPS** (not
Dokploy) that sits on the tailnet, so alert probes can reach the OBS and ingest
boxes on their Tailscale IPs.

## Components

| Service | Image | Ports (host) | Role |
| --- | --- | --- | --- |
| `web-monitor` | `apps/web-monitor` (Next.js) | internal `3000` | Dashboard (alert state, history, rule + notification config UI) |
| `alert-worker` | `apps/alert-worker` (Bun) | — | The alert engine: self-ticks every 15s, notifies Discord/Telegram, pings healthchecks.io |
| `telegraf` | `telegraf` | — | Scrapes Supabase platform metrics (prod + staging) into the per-env Influx buckets |
| `caddy` | `caddy` | `80`, `443` | TLS for `monitor.streamwizard.org` |

There is **no InfluxDB container** — the existing external instance stays where
it is. The alert engine is single-env: this deployment runs with the prod
Doppler config and monitors prod only. A staging deployment elsewhere needs its
own alert-worker with its own Doppler config.

## Provisioning runbook

1. **VPS**: any small box (2 vCPU / 2 GB is plenty). `sudo sh provision.sh`
   installs Docker + Tailscale and configures ufw (80/443 + tailnet in).
2. **Tailscale**: `sudo tailscale up` on the host and approve the node.
   Containers reach tailnet IPs through the host — no sidecar needed (see
   below).
3. **Doppler**: two configs, one per service.
   - `prd_web_monitor` (dashboard): clone vars from `dev_web_monitor`, point at
     prod Supabase/Influx bucket, and add `ALERT_ENV=prod` (Next standalone
     clobbers NODE_ENV, so the env badge must be explicit),
     `NEXT_PUBLIC_BASE_URL=https://monitor.streamwizard.org` (auth redirects;
     the prd root config's value points at the main site), plus
     `ALERT_DISCORD_CHANNEL_ID`, `DISCORD_BOT_TOKEN`, `TELEGRAM_BOT_TOKEN`,
     `TELEGRAM_CHAT_ID`, `STREAMWIZARD_API_URL` (the /alerts/notifications UI
     reads them for defaults and test sends). Mint a **service token** →
     `DOPPLER_TOKEN` in `.env`.
   - the root `prd` config (engine — no branch config): make sure it has
     `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `INFLUXDB_URL`, `INFLUXDB_TOKEN`,
     `INFLUXDB_ORG`, `INFLUXDB_BUCKET` (prod bucket), `ALERT_ENV=prod`,
     `NODE_ENV=production`, `ALERT_DISCORD_CHANNEL_ID`, `DISCORD_BOT_TOKEN`,
     `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `STREAMWIZARD_API_URL`,
     `WS_SERVER_URL` (same value as web-monitor's
     `NEXT_PUBLIC_WS_SERVER_URL`), and optionally `SENTRY_DSN`. Mint a
     **service token** for `prd` → `ALERT_WORKER_DOPPLER_TOKEN` in `.env`.
     (Locally the alert-worker runs off the root `dev` config — see
     `apps/alert-worker/doppler.yaml`.)
   - Telegram: create the bot via @BotFather, message it once, then read the
     chat id from `https://api.telegram.org/bot<token>/getUpdates`.
   - Discord: the bot must be in the alerts guild with *Send Messages* +
     *Embed Links* on the alert channel.
4. **DNS**: A record `monitor.streamwizard.org` → VPS public IP (Caddy needs it
   resolving before first boot to get its certificate).
5. **healthchecks.io**: create a check with a 60s period / ~3 min grace and a
   Telegram or email integration — this is the dead-man's switch that fires
   when the whole VPS (or the alert-worker) goes dark. Put the ping URL in `.env`.

## Run

```bash
git clone git@github.com:streamwizard/streamwizard.git && cd streamwizard/docker/monitor-vps
cp .env.example .env   # fill everything in
docker compose up --build -d
docker compose logs -f
```

Update: `git pull && docker compose up --build -d`.

## Verification

- `docker compose logs alert-worker` — two consecutive `ok {...}` tick summaries,
  and the healthchecks.io check shows pings arriving.
- `docker compose exec telegraf telegraf --test --config /etc/telegraf/telegraf.conf`
  — prints `node_*` / `pg_*` series with the right `influx_bucket` tag (the
  tag itself is stripped on write). Then confirm points in both buckets via
  the Influx UI.
- `docker compose stop alert-worker` → healthchecks.io flips to *down* within its
  grace period → `docker compose start alert-worker`.

## Tailnet reachability

`alert-worker` runs on a normal bridge network; Docker masquerades its outbound
traffic, so connections to `100.x` tailnet IPs go out via the host's
`tailscale0` and probes to OBS/ingest boxes just work. If they don't (probe
rules for nodes report down while `curl http://<tailscale-ip>:8090/health`
works on the host), the quick fix is `network_mode: host` on the `alert-worker`
service — it publishes no ports, so nothing else needs to change.
