#!/bin/sh
# Scrape a Supabase privileged-metrics endpoint for inputs.exec.
#
# The endpoint concatenates the output of several exporters (node, postgres,
# gotrue, ...), so # HELP / # TYPE comment lines repeat per metric name —
# telegraf's strict prometheus text parser rejects that ("second HELP line").
# awk keeps only the first HELP/TYPE line per metric and passes everything
# else through untouched.
set -eu

url="$1"
key="$2"

auth=$(printf '%s' "service_role:${key}" | base64 | tr -d '\n')
wget -qO- -T 15 --header="Authorization: Basic ${auth}" "$url" |
  awk '/^# (HELP|TYPE) /{ k=$2" "$3; if (seen[k]++) next } { print }'
