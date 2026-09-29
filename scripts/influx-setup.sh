#!/usr/bin/env bash
# Creates the InfluxDB layout for one environment: an org, the fixed
# per-service buckets from packages/metrics/src/buckets.ts, and scoped tokens.
# Safe to re-run: existing orgs, buckets and tokens (matched by description)
# are left alone.
#
# Usage: scripts/influx-setup.sh <dev|staging|prod>
# Needs the influx CLI with an active config whose token can create orgs
# (an operator token), or an All Access token of an org you created in the UI.
# New tokens are printed once; put them in Doppler.
set -euo pipefail

ENV="${1:-}"
case "$ENV" in
  dev | staging | prod) ;;
  *)
    echo "usage: $0 <dev|staging|prod>" >&2
    exit 1
    ;;
esac

ORG="streamwizard-$ENV"

# bucket:retention. Keep in sync with BUCKETS in packages/metrics/src/buckets.ts.
BUCKETS=(
  "rest-api:30d"
  "ws-server:30d"
  "bot:30d"
  "auto-switcher:30d"
  "ingest-nodes:30d"
  "obs-nodes:30d"
  "supabase-platform:30d"
  "vm-backups:400d"
  "proxmox:90d"
)

# Doppler has one shared config per environment, so every service in it,
# and every node rest-api hands it to on claim, uses the same INFLUXDB_TOKEN:
# one token that reads and writes all of the buckets above.

if ! influx org list --name "$ORG" --hide-headers >/dev/null 2>&1; then
  echo "creating org $ORG"
  influx org create --name "$ORG" >/dev/null
fi

bucket_id() {
  influx bucket list --org "$ORG" --name "$1" --hide-headers | awk '{print $1}'
}

for entry in "${BUCKETS[@]}"; do
  name="${entry%%:*}"
  retention="${entry##*:}"
  if [[ -z "$(bucket_id "$name" 2>/dev/null)" ]]; then
    echo "creating bucket $ORG/$name ($retention)"
    influx bucket create --org "$ORG" --name "$name" --retention "$retention" >/dev/null
  fi
done

existing_descriptions="$(influx auth list --org "$ORG" --json | jq -r '.[].description')"

create_token() {
  local description="$1"
  shift
  if grep -qxF "$description" <<<"$existing_descriptions"; then
    echo "token $ORG/$description exists, skipped"
    return
  fi
  local token
  token="$(influx auth create --org "$ORG" --description "$description" "$@" --json | jq -r '.token')"
  echo "token $ORG/$description: $token"
}

token_args=()
for entry in "${BUCKETS[@]}"; do
  id="$(bucket_id "${entry%%:*}")"
  token_args+=(--read-bucket "$id" --write-bucket "$id")
done
create_token "$ORG-all" "${token_args[@]}"

# Proxmox VE pushes its own metrics (Datacenter → Metric Server → InfluxDB).
# This token lives in the PVE config, not Doppler, so it only writes proxmox.
create_token "$ORG-proxmox" --write-bucket "$(bucket_id proxmox)"
