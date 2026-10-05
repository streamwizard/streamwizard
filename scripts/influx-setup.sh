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

# Buckets only the prod org has (PROD_ONLY_BUCKETS in buckets.ts). The Telegraf
# on the Dokploy server writes prod and staging containers into the prod org.
if [[ "$ENV" == "prod" ]]; then
  BUCKETS+=("webserver:30d")
fi

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

auths="$(influx auth list --org "$ORG" --json)"
existing_descriptions="$(jq -r '.[].description' <<<"$auths")"

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
bucket_ids=()
for entry in "${BUCKETS[@]}"; do
  id="$(bucket_id "${entry%%:*}")"
  bucket_ids+=("$id")
  token_args+=(--read-bucket "$id" --write-bucket "$id")
done

# Does the token with this description read and write every bucket above?
covers_all() {
  local permissions id
  permissions="$(jq -r --arg d "$1" '.[] | select(.description == $d) | .permissions[]' <<<"$auths")"
  for id in "${bucket_ids[@]}"; do
    grep -q "^read:.*buckets/$id\$" <<<"$permissions" && grep -q "^write:.*buckets/$id\$" <<<"$permissions" || return 1
  done
}

# A token's permissions are fixed when it is made, so an all token from before
# a bucket was added cannot read or write that bucket. The all tokens are
# therefore numbered: <org>-all, <org>-all-2, <org>-all-3, ... When none of
# them covers every bucket, the next one is made. Older ones keep working for
# the apps and nodes that still hold them.
all_tokens="$(grep -E "^$ORG-all(-[0-9]+)?\$" <<<"$existing_descriptions" || true)"
covering=""
highest=0
while IFS= read -r description; do
  [[ -z "$description" ]] && continue
  number="${description#"$ORG-all"}"
  number="${number#-}"
  number="${number:-1}"
  ((number > highest)) && highest="$number"
  if covers_all "$description"; then
    covering="$description"
  fi
done <<<"$all_tokens"

if [[ -n "$covering" ]]; then
  echo "token $ORG/$covering covers every bucket, skipped"
elif ((highest == 0)); then
  create_token "$ORG-all" "${token_args[@]}"
else
  create_token "$ORG-all-$((highest + 1))" "${token_args[@]}"
  echo "No older all token covers every bucket. Put the new one in Doppler as INFLUXDB_TOKEN." >&2
  echo "  Delete the older ones only after every app and node uses the new token." >&2
fi

# Proxmox VE pushes its own metrics (Datacenter → Metric Server → InfluxDB).
# This token lives in the PVE config, not Doppler, so it only writes proxmox.
create_token "$ORG-proxmox" --write-bucket "$(bucket_id proxmox)"

# The Telegraf on the Dokploy server (telegraf repo, host/) writes
# host and container metrics and the Supabase platform scrape. It only writes
# these two buckets. Goes in Doppler as INFLUXDB_TELEGRAF_TOKEN. Prod only:
# that is the one org it writes to.
if [[ "$ENV" == "prod" ]]; then
  create_token "$ORG-telegraf" \
    --write-bucket "$(bucket_id webserver)" \
    --write-bucket "$(bucket_id supabase-platform)"
fi
