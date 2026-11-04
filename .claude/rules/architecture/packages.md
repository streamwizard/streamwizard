---
paths:
  - "packages/**"
  - "apps/*/src/**"
  - "apps/*/*.config.*"
  - "**/package.json"
  - "**/tsconfig.json"
---

# Imports and packages

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md); this page has the detail.

## Imports

- **Inside an app:** import your own code with `@/` (maps to `src/`). `./x` and `./sub/x` (same folder or below) are fine; never climb with `../` or `../../`. The alias is set up in every TypeScript app (`"paths": { "@/*": ["./src/*"] }` in its tsconfig). Exceptions: `src/instrumentation.ts` in the Next apps imports `../sentry.server.config` / `../sentry.edge.config` (Sentry keeps them at the app root), and root config files (`next.config.ts`, `sentry.*.config.ts`) import `./src/...`.
- **Inside a package:** use relative imports. Never `@/`: package source is compiled by the consuming app, so `@/` resolves against that app's `src/`. The shadcn components in `packages/ui` importing `@/lib/utils` are a legacy exception; do not add more.
- **Across workspaces:** always `@repo/<package>` or a subpath listed in its `package.json` `exports`. Never a relative path into another app or package, and never `@repo/<package>/src/...`. A new entry point means a new `exports` entry. The one exception is Tailwind's `@source "../../../../packages/<pkg>/src"` in an app's `globals.css`, which tells Tailwind to scan a workspace package for classes; add one when an app starts rendering a package's Tailwind classes.
- **`@repo/ui` components in server components** (pages, layouts and any file without `"use client"`): import the file by subpath, `@repo/ui/components/ui/<name>`, never the `@repo/ui` barrel. Through the barrel, one client component pulls the whole kit into the page bundle (SW-286). Client components may keep using `@repo/ui` until the barrel is split.
- **Test mocks follow the same rules:** `mock.module("@/lib/env", ...)` in apps, never `mock.module("../...")`.
- **Existing `../` imports** (2026-11 baseline: about 260 in discord-bot, 230 in web-streamwizard, 15 in web-admin, 11 in streamwizard-bot; the other apps have none outside the exceptions above): convert them in files you are already changing, and never add new ones. No mass rewrites in unrelated PRs; a per-app conversion is its own PR.

## Shared packages

| Package | Use it for |
|---------|-----------|
| `@repo/supabase` | All Supabase clients, generated `Database` types, query modules, token helpers. |
| `@repo/twitch-api` | Typed Twitch Helix client (`TwitchApi`). |
| `@repo/twitch-eventsub` | EventSub transport and shard management. |
| `@repo/twitch-assets` | Twitch-derived widget data: ads, polls, predictions, labels, emotes, credits. |
| `@repo/discord-api`, `@repo/discord-message` | Discord REST client; message builder schema, buttons, variables, limits, themes. |
| `@repo/telegram-api` | Telegram client. |
| `@repo/ui` | Shared React components; overlay renderers via `@repo/ui/overlay`; chat and message builders. |
| `@repo/schemas`, `@repo/types` | Shared Zod schemas and TypeScript contracts (EventSub payloads, WS messages). |
| `@repo/storage` | S3-compatible storage (R2, MinIO). |
| `@repo/obs-web`, `@repo/proxmox`, `@repo/backups`, `@repo/cms`, `@repo/alerting` | Domain/infrastructure logic. |
| `@repo/sentry` | Sentry options and integrations. Bun services wire it in `src/sentry.ts`; Next apps in `sentry.server.config.ts`, `sentry.edge.config.ts` and `src/instrumentation*.ts`. |
| `@repo/posthog`, `@repo/metrics` | Product analytics; metrics. |
| `@repo/logger` | Stream-event logger only (`streamEventsLogger`), not a general logger. |
| `@repo/service-token`, `@repo/node-token` | Per-service Ed25519 tokens; OBS/ingest node tokens. |
| `@repo/ttl-cache` | The in-process TTL cache (`TtlCache`) and `MissLimiter`. Every cache, cooldown and fixed-window counter (see [caching.md](caching.md)). |
| `@repo/user-state` | Per-user widget state service. |
| `@repo/ws-client` | Server-to-server HTTP calls into ws-server's internal endpoints (broadcast, socket revoke, ingest sessions), signed with `@repo/service-token`. Not a browser WebSocket client. |
| `@repo/docs-shots` | Playwright screenshots for `apps/docs` (outside the Turbo pipeline). |
| `@repo/typescript-config` | Shared tsconfig bases. |

### Package layout

Packages get the same care as apps. Based on Turborepo's guidance on [internal packages](https://turborepo.dev/docs/core-concepts/internal-packages) and [structuring a repository](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository) (explicit `exports`, no barrel files):

- **One purpose per package**, and the name says what it is. A new purpose is a new package, not a new folder in a nearby one. `@repo/ui` is the known exception (primitives, overlay runtime, chat, message builder, each behind its own entry point); new domains do not go into it, and the overlay runtime and its schemas are the first candidate to split out as `@repo/overlay`.
- **Group by domain inside `src/`.** Once a package has more than about 8 source files at its root, or file names share a prefix (`discord-*`, `ticket-*`), that prefix becomes a folder: `queries/discord/voice.ts`, not `queries/discord-voice.ts`.
- **The public API is the `exports` field.** Every entry point is listed there; anything not exported is private and must not be imported from outside. Shared internals go in `src/lib/` (never exported). For a folder that is public by design, use a subpath pattern (`"./queries/*": "./src/queries/*.ts"`) instead of one hand-written line per file; a pattern makes every file in that folder public, so move helpers such as `queries/with-metrics.ts` into `src/lib/` before switching.
- **No barrel files.** No `index.ts` inside a folder, and no `foo.ts` next to a `foo/` folder, that re-exports it; consumers import the file they need. Barrels pull whole folders into every bundle, including server-component bundles. The package's `.` entry (`src/index.ts`) is allowed but uses **named** re-exports only (`export { X } from "./x"`, never `export *`), lists only the package's main API, and does not repeat what a subpath already exports. Everything else is reached through its own subpath or a subpath pattern.
- **No side effects at import** beyond what the package exists for (no connections opened, no timers, no env parsed for features the caller didn't use).
- **Declare it: `"sideEffects": false`** in the `package.json` of every package a Next app imports, so the bundler can drop the files a page doesn't use. A package that imports CSS lists those files instead (`"sideEffects": ["*.css"]`). Only set it when the package really has no import-time side effects (previous bullet).
- **`package.json` shape:** `"name": "@repo/<folder>"`, `"private": true`, `"type": "module"`, and `exports` entries of the form `{ "types": "./src/x.ts", "default": "./src/x.ts" }` that point at TypeScript source. There is no build step; the consuming app compiles it. Scripts: `check-types` (`tsc --noEmit`) always, `test` when there are tests. `tsconfig.json` extends `@repo/typescript-config/base.json` (or `react-library.json` for React packages).
- **Packages never import from apps**, and imports between packages go one way (no cycles).
- **Every package has a `README.md`:** what it's for, its entry points, and every env variable it reads.
- **Tests sit next to the file** (`*.test.ts`), relative imports inside (see Imports above).

**Current state:** `@repo/supabase` is the main offender. `src/queries/` has 53 flat files, with families that should be folders (8 `discord*`, 8 `ticket*`, 3 `alert-*`, `ingest`/`ingest-nodes`, `overlays`/`overlay-*`); `package.json` lists its exports by hand; `queries/obs-nodes.ts` is a barrel beside an `obs-nodes/` folder; `queries/with-metrics.ts` and `queries/clip-folder-utils.ts` are internals outside `src/lib/`; and `src/index.ts` mixes the client with Twitch token helpers and feedback. Flat `src/` roots (non-test files): `@repo/schemas` (27), `@repo/twitch-api` (20), `@repo/cms` (14), `@repo/metrics` (14), `@repo/discord-message` (12), `@repo/twitch-assets` (12), `@repo/posthog` (11), `@repo/docs-shots` (11), `@repo/alerting` (9, plus `rules.ts` beside `rules/`), `@repo/backups` (9). `export *` barrels as the `.` entry: ui, schemas, metrics, cms, discord-message, backups, types, obs-web, proxmox. `@repo/ui` exposes two big barrels, `src/index.ts` (76 re-exports, the whole shadcn kit) as `.` and `src/overlay-exports.ts` (106) as `./overlay`, and apps import the bare `@repo/ui` about 490 times. Only `@repo/ui` sets `sideEffects`. 16 of 27 packages have no README. Restructure one package per PR, and keep the old export paths working (or update every import) in the same PR.
