---
paths:
  - "apps/*/src/**"
  - "packages/*/src/**"
  - "docs/**"
  - ".github/**"
  - "package.json"
  - "biome.json*"
  - ".dependency-cruiser.*"
  - "knip.json*"
  - "lefthook.yml"
  - ".gitattributes"
---

# Repo hygiene

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md).

The rulebook only holds if machines check it. Every rule a tool can check should be checked by one, in CI.

## Lint and structure checks

- **Biome** lints and formats every app and package (one root `biome.json`, no per-app configs). It checks at least:
  - no `process.env` outside `env.ts` and the allowed exceptions ([env.md](env.md))
  - `import type` for type-only imports ([types.md](types.md))
  - no unused variables or imports
  - no bare `TODO`/`FIXME` (see below)
  - a file size warning above 400 lines
- **dependency-cruiser** checks the import rules ([packages.md](packages.md), [web-apps.md](web-apps.md)):
  - no `../` imports that leave the current folder in apps
  - web app features never import other features
  - packages never import apps; no import cycles anywhere
  - nothing imports another workspace's internals (only `@repo/*` entry points in `exports`)
- **Fix the code, not the rule.** Disable a lint rule for one line only, with a comment saying why (`// biome-ignore lint/...: <reason>`). Never turn a rule off repo-wide to make a PR pass.

## Dead code

- **knip** finds unused files, exports and dependencies. It runs in CI and must not report anything new.
- **Delete, don't comment out.** Git has the history. No commented-out blocks, no `_old`, `-v2` or `.bak` files, no unused exports "for later".
- **Removing a feature removes all of it:** components, actions, routes, query functions, types, schemas, tests, env variables, dependencies, feature flags and docs.

## What lives in the repo

- **`docs/` holds lasting documentation only:** guides, brand and tone, runbooks. Plans, task prompts, research notes, audit results and one-off HTML go to Confluence or Jira, never the repo.
- **New files in `docs/` are git-ignored** (`/docs/` in `.gitignore`), so local notes there never get committed by accident; tracked docs stay tracked. A new lasting doc is added on purpose with `git add -f`, and only when it says nothing a public repo shouldn't (the auth walkthrough stays in Confluence, see [auth-and-security.md](auth-and-security.md)).
- **No scratch files anywhere in the tree:** `CLEANUP.md`, `ISSUES.md`, `notes.md`, test output, screenshots that no doc uses.
- **The repo root stays small:** config files, `.env.example`, `README.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `LICENSE`, and the `apps/`, `packages/`, `supabase/`, `scripts/` and `docs/` folders. New root files need a reason.

## TODOs

- **Every `TODO` or `FIXME` names a Jira ticket:** `// TODO(SW-123): drop the legacy path after OIM #52 ships`. No ticket, no TODO: either do it now or create the ticket.
- When the ticket closes, its TODOs go too.

## File size

- **Split files over about 400 lines** by responsibility (a state machine's transitions, its timers, its reporting). Long files hide duplication and are hard to review.
- Generated files, schema lists and test fixtures are exempt.

## Generated files

- **Mark generated files in `.gitattributes`** with `linguist-generated=true` (for example `packages/supabase/src/types/supabase.ts`), so PR diffs collapse them.
- Never hand-edit a generated file without a comment at the edit saying why, and regenerate it when possible.

## Pre-commit and CI

- **A fast pre-commit hook (lefthook)** runs format and lint on staged files, and the migration check when `supabase/` changed. It must stay under a few seconds; heavy checks belong in CI.
- **`pr-check.yml` runs every check** on each PR to `staging` or `main`: types, tests, Biome, dependency-cruiser, knip and `check:dupes`. `db-check.yml` covers the database. A PR that fails a check doesn't merge.
- **Ratchet, never loosen.** Checks that start with existing violations (dupes threshold, knip, dependency-cruiser) record a baseline. A PR may lower it, never raise it.

## Regular audits

- **The whole repo is audited against this rulebook once a month**, with the audit prompt in `~/streamwizard-audits/rulebook-audit-prompt.md`, scheduled as a recurring task. Findings become Jira tickets; rule fixes go into this folder.

**Current state:** none of the tools above is set up yet. `packages/eslint-config` is gone; the three Next apps still lint with their own `eslint.config.mjs` (`eslint-config-next`), and the Bun services and packages have no linter. Biome replaces all of it. `check:dupes` exists but doesn't run in CI; there is no knip, dependency-cruiser, lefthook or `.gitattributes`. Setting them up is its own piece of work, with baselines for what's already there.
