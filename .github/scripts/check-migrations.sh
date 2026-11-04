#!/usr/bin/env bash
# Checks the migrations a branch adds against its base branch, before merge.
# Catches what makes the deploy-*-db workflows fail or silently undo work:
#
#   1. a new migration older than the newest one on the base branch
#      (`supabase db push` refuses it)
#   2. a malformed name or a timestamp used twice
#   3. an edit to a migration that already exists on the base branch
#      (it never runs again remotely)
#   4. a CREATE FUNCTION for a function the base branch redefined after this
#      branch was cut (the old body would overwrite the newer one)
#
# Usage: .github/scripts/check-migrations.sh [base-ref]   (default origin/staging)
# Only committed changes are checked. Run `git fetch origin` first.
set -euo pipefail

BASE="${1:-origin/staging}"
DIR="supabase/migrations"
errors=0

err() {
  local file="$1" msg="$2"
  errors=$((errors + 1))
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    echo "::error file=${file}::${msg}"
  else
    echo "ERROR ${file}: ${msg}"
  fi
}

if ! git rev-parse --verify -q "$BASE" >/dev/null; then
  echo "Base ref $BASE not found. Run: git fetch origin" >&2
  exit 2
fi

merge_base="$(git merge-base "$BASE" HEAD)"

# Function names defined in a file at a given revision, normalised to
# schema.name (public when unqualified), one per line.
functions_in() {
  local rev="$1" file="$2"
  git show "${rev}:${file}" 2>/dev/null \
    | grep -oiE 'create[[:space:]]+(or[[:space:]]+replace[[:space:]]+)?function[[:space:]]+[a-z0-9_."]+' \
    | awk '{print tolower($NF)}' \
    | tr -d '"' \
    | awk '{ if (index($0, ".") == 0) print "public." $0; else print $0 }' \
    | sort -u || true
}

latest_base="$(git ls-tree --name-only "$BASE" "$DIR/" | sed 's#.*/##' | grep -oE '^[0-9]{14}' | sort | tail -1 || true)"

added="$(git diff --name-only --diff-filter=A "$BASE"...HEAD -- "$DIR" | grep '\.sql$' || true)"
changed="$(git diff --name-only --diff-filter=MDR "$BASE"...HEAD -- "$DIR" | grep '\.sql$' || true)"

# 1 + 2: names and order of new migrations.
for f in $added; do
  name="$(basename "$f")"
  if ! [[ "$name" =~ ^[0-9]{14}_[a-z0-9_]+\.sql$ ]]; then
    err "$f" "Migration names must be <14-digit timestamp>_<snake_case>.sql."
    continue
  fi
  ts="${name:0:14}"
  if [ -n "$latest_base" ] && [ "$ts" -le "$latest_base" ]; then
    err "$f" "Timestamp $ts is not newer than the latest migration on $BASE ($latest_base). Rename it to a newer timestamp, or the deploy workflow refuses it."
  fi
done

dupes="$(git ls-tree --name-only HEAD "$DIR/" | sed 's#.*/##' | grep -oE '^[0-9]{14}' | sort | uniq -d || true)"
for ts in $dupes; do
  err "$DIR" "Timestamp $ts is used by more than one migration."
done

# 3: existing migrations must never change.
for f in $changed; do
  err "$f" "This migration already exists on $BASE. Editing, renaming or deleting it has no effect on databases that already ran it. Add a new migration instead."
done

# 4: functions the base branch redefined after this branch was cut.
base_since="$(git diff --name-only --diff-filter=AM "$merge_base" "$BASE" -- "$DIR" | grep '\.sql$' || true)"
if [ -n "$added" ] && [ -n "$base_since" ]; then
  base_funcs="$(for f in $base_since; do functions_in "$BASE" "$f"; done | sort -u)"
  for f in $added; do
    for fn in $(functions_in HEAD "$f"); do
      if grep -qxF "$fn" <<<"$base_funcs"; then
        err "$f" "Redefines $fn, which $BASE also changed after this branch was cut. Rebase on $BASE and start from the latest body of $fn, or this migration undoes that change."
      fi
    done
  done
fi

count="$(echo "$added" | grep -c . || true)"
if [ "$errors" -gt 0 ]; then
  echo "Migration check failed: $errors problem(s) in $count new migration(s) against $BASE."
  exit 1
fi
echo "Migration check passed: $count new migration(s) against $BASE (latest there: ${latest_base:-none})."
