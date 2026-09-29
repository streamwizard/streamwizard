#!/usr/bin/env bash
# Creates the InfluxDB layout for one environment: an org, the fixed
# per-service buckets from packages/metrics/src/buckets.ts, and scoped tokens.
# Safe to re-run: existing orgs, buckets and tokens (matched by description)
# are left alone.
#
# Usage: scripts/influx-setup.sh <dev|staging|prod>
# Needs the influx CLI with an active config whose token can create orgs
# (an operator token). New tokens are printed once; put them in Doppler.
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
)

# token description -> buckets it may write. Doppler var in the comment.
declare -A WRITE_TOKENS=(
  ["rest-api"]="rest-api vm-backups"        # rest-api INFLUXDB_TOKEN
  ["ws-server"]="ws-server"                 # ws-server INFLUXDB_TOKEN
  ["bot"]="bot"                             # streamwizard-bot INFLUXDB_TOKEN
  ["auto-switcher"]="auto-switcher"         # obs-auto-switcher INFLUXDB_TOKEN
  ["obs-node"]="obs-nodes"                  # rest-api INFLUXDB_OBS_NODE_TOKEN
  ["ingest-node"]="ingest-nodes"            # rest-api INFLUXDB_INGEST_NODE_TOKEN
  ["supabase-telegraf"]="supabase-platform" # supabase-telegraf INFLUXDB_TOKEN
)
READ_TOKEN="read-all" # web-admin + alert-worker INFLUXDB_TOKEN

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

for description in "${!WRITE_TOKENS[@]}"; do
  args=()
  for bucket in ${WRITE_TOKENS[$description]}; do
    args+=(--write-bucket "$(bucket_id "$bucket")")
  done
  create_token "$ORG-$description" "${args[@]}"
done

read_args=()
for entry in "${BUCKETS[@]}"; do
  read_args+=(--read-bucket "$(bucket_id "${entry%%:*}")")
done
create_token "$ORG-$READ_TOKEN" "${read_args[@]}"
