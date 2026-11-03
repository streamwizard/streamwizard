---
paths:
  - "packages/**"
  - "**/package.json"
  - "**/tsconfig.json"
---

# Imports and packages

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md); this page has the detail.

## Imports

- **Inside an app:** import your own code with `@/` (maps to `src/`). Same-folder `./x` is fine; never climb with `../` or `../../`. The alias is set up in every TypeScript app (`"paths": { "@/*": ["./src/*"] }` in its tsconfig).
- **Inside a package:** use relative imports. Never `@/`: package source is compiled by the consuming app, so `@/` resolves against that app's `src/`. The shadcn components in `packages/ui` importing `@/lib/utils` are a legacy exception; do not add more.
- **Across workspaces:** always `@repo/<package>` or a subpath listed in its `package.json` `exports`. Never a relative path into another app or package, and never `@repo/<package>/src/...`. A new entry point means a new `exports` entry.
- **Existing `../` imports** (mostly discord-bot and web-streamwizard): convert them in files you are already changing. No mass rewrites in unrelated PRs.

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
| `@repo/sentry` | Sentry options and integrations. Each service wires it in its own `src/sentry.ts`. |
| `@repo/posthog`, `@repo/metrics` | Product analytics; metrics. |
| `@repo/logger` | Stream-event logger only (`streamEventsLogger`), not a general logger. |
| `@repo/service-token`, `@repo/node-token` | Per-service Ed25519 tokens; OBS/ingest node tokens. |
| `@repo/ttl-cache` | The in-process TTL cache (`TtlCache`) and `MissLimiter`. Every cache, cooldown and fixed-window counter (see [caching.md](caching.md)). |
| `@repo/user-state`, `@repo/ws-client` | Per-user widget state; WebSocket client. |
| `@repo/docs-shots` | Playwright screenshots for `apps/docs` (outside the Turbo pipeline). |
| `@repo/typescript-config` | Shared tsconfig bases. |

### Package layout

Packages get the same care as apps. Based on Turborepo's guidance on [internal packages](https://turborepo.dev/docs/core-concepts/internal-packages) and [structuring a repository](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository) (explicit `exports`, no barrel files):

- **One purpose per package**, and the name says what it is. A new purpose is a new package, not a new folder in a nearby one.
- **Group by domain inside `src/`.** Once a package has more than about 8 source files at its root, or file names share a prefix (`discord-*`, `ticket-*`), that prefix becomes a folder: `queries/discord/voice.ts`, not `queries/discord-voice.ts`.
- **The public API is the `exports` field.** Every entry point is listed there; anything not exported is private and must not be imported from outside. Shared internals go in `src/lib/` (never exported). For a folder that is public by design, use a subpath pattern (`"./queries/*": "./src/queries/*.ts"`) instead of one hand-written line per file.
- **No barrel files.** Don't add an `index.ts` (or a `foo.ts` next to a `foo/` folder) that re-exports a folder; consumers import the file they need. Barrels pull whole folders into every bundle, including server-component bundles. The package's `.` entry stays small: its main API only.
- **No side effects at import** beyond what the package exists for (no connections opened, no timers, no env parsed for features the caller didn't use).
- **Packages never import from apps**, and imports between packages go one way (no cycles).
- **Every package has a `README.md`:** what it's for, its entry points, and every env variable it reads.
- **Tests sit next to the file** (`*.test.ts`), relative imports inside (see Imports above).

**Current state:** `@repo/supabase` is the main offender. `src/queries/` has 53 flat files, with families that should be folders (9 `discord-*`, 8 `ticket-*`, 3 `alert-*`, `ingest`/`ingest-nodes`, `overlays`/`overlay-*`); `package.json` lists 69 exports by hand; `queries/obs-nodes.ts` is a barrel beside an `obs-nodes/` folder; and `src/index.ts` mixes the client with Twitch token helpers and feedback. Others: `@repo/schemas` (27 files), `@repo/twitch-api` (20), `@repo/cms` (14) and `@repo/metrics` (14) keep everything at the `src/` root, and 15 of 26 packages have no README. Restructure one package per PR, and keep the old export paths working (or update every import) in the same PR.
