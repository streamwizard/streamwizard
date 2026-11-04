---
paths:
  - "apps/rest-api/**"
  - "apps/ws-server/**"
  - "apps/streamwizard-bot/**"
  - "apps/discord-bot/**"
  - "apps/obs-auto-switcher/**"
  - "apps/alert-worker/**"
---

# Backend services

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md); this page has the detail.

## Backend services

### Service folder layout (all Bun apps)

Every Bun service (rest-api, ws-server, streamwizard-bot, discord-bot, obs-auto-switcher, alert-worker) is organized **by domain first, then by layer inside each domain**. This follows [Node.js Best Practices 1.1 and 1.2](https://github.com/goldbergyoni/nodebestpractices#1-project-architecture-practices) and [Hono's best practices](https://hono.dev/guides/best-practices):

```
src/
  index.ts             starts the process only: process handlers, start server and jobs, shutdown. No logic.
  app.ts               builds the Hono app / WS server and mounts each module's routes, or wires a worker's
                       parts without starting them (importable in tests). discord-bot's lives in http/app.ts.
  sentry.ts
  lib/env.ts           env schema (rest-api's src/env.ts is a legacy exception)
  modules/<domain>/    one folder per business domain: eventsub/, ingest-nodes/, rooms/, ...
    routes.ts          HTTP entry point: a Hono sub-app mounted with app.route()
                       (ws-server: a (req, pathname) => Response | null function).
                       Parses and validates input, calls the domain, returns the response.
    socket.ts          WebSocket entry point: this domain's message handlers. Same job as routes.ts.
    <feature>.ts       domain logic: plain values in, plain values out
    schemas.ts         Zod schemas for this domain's input
    jobs.ts            pollers/sweepers and timers that belong to this domain
    *.test.ts          next to the file they cover
  middleware/          cross-cutting HTTP guards only: auth, rate limits, security headers
  lib/                 generic helpers with no domain (secret-compare, r2 client)
  scripts/             one-off CLI scripts run from a package.json script
  types/<domain>.ts    exported app-wide types (see types.md; shared contracts go in @repo/types)
```

The three layers, per domain:

| Layer | Where | Job |
|-------|-------|-----|
| Entry point | `modules/<domain>/routes.ts`, `socket.ts` or job runners | Adapt the request to plain values, validate, call the domain, shape the response. |
| Domain | `modules/<domain>/*.ts` | Business logic. Knows nothing about HTTP or WebSockets. |
| Data access | `@repo/supabase/queries/*` (shared) | All database calls. |

Rules:

- **Group by domain, not by technical role.** No app-wide `routes/`, `controllers/`, `services/` or `jobs/` folders; a domain's routes and jobs live in its module.
- **Never pass Hono `Context` or `Request`/`Response` into domain code.** Read what you need in `routes.ts` and pass plain values, so the logic is testable and reusable from jobs and other transports. (In ws-server the connection registries hold sockets by design; that's their domain.)
- **A large domain may split into sub-folders** (`modules/obs-nodes/node/`, `modules/obs-nodes/instances/`, `modules/eventsub/handlers/`). The module still has one `routes.ts` at its root that mounts the sub-folders' code; sub-folders hold domain files and tests, and follow the same layering.
- **Context variables are declared by the middleware that sets them**, in a `declare module "hono" { interface ContextVariableMap { ... } }` block in that middleware file, so handlers read `c.var.x` without casts. Only read a variable on routes that mount its middleware; the type is global and does not prove the middleware ran.
- **Routes use `app.route()` with per-domain sub-apps, handlers written inline.** No Rails-style controller classes (they break Hono's type inference). If a handler must be shared, use `factory.createHandlers()` from `hono/factory`.
- **Modules talk through exported functions of their feature files.** Another module may import exported functions from `modules/<other>/<feature>.ts` (eventsub calling `postGoLive` from `discord-live/posts.ts`), but never its `routes.ts`, `socket.ts`, `jobs.ts`, `schemas.ts`, test files or unexported helpers, and no `index.ts` barrels. If two modules need the same helper, it moves to `lib/` (generic) or a package (shared across apps).
- **Jobs are factories with injected deps.** A poller or sweeper exports `createX(deps)` returning `{ start, stop }` (tests drive it with fake deps) and one live instance built from the real deps, or `null` when its env is not set. `index.ts` starts each live instance; nothing starts itself on import. Put it in the domain's `jobs.ts`, or in a file named for the job (`poller.ts`, `role-sweeper.ts`) when a module has more than one.
- **No new files at the `src/` root** besides `index.ts`, `app.ts` and `sentry.ts`. Exported types go in `src/types/` ([types.md](types.md)).
- **A new domain gets a new `modules/<domain>/` folder**, even if it starts with one file.
- **File names are kebab-case.** Exception: discord-bot `events/` files are camelCase. A top-level `events/<name>.ts` is named after the discord.js event it listens to (`guildMemberAdd.ts`). A second listener for the same event goes in a subfolder named for its feature and is named after what it records (`events/server-log/memberBanned.ts` for `GuildBanAdd`). Commands in `commands/` stay kebab-case.
- **Framework folders are allowed when the framework needs them:** discord-bot's `commands/`, `events/`, `handlers/` (auto-discovery) and `http/` (its Hono app, `routes/` and `middleware/`). One-off CLI scripts run from a `package.json` script go in `src/scripts/` (discord-bot `deploy-commands.ts`); ambient module augmentations go in `src/types/*.d.ts`. Domain logic those commands, events and routes call still goes in `modules/`.

**Current state:** ws-server and obs-auto-switcher follow this layout (ws-server is the reference for a non-Hono server, obs-auto-switcher for a worker with no public routes). ws-server still has `src/types.ts` at the root, a barrel `modules/monitor/index.ts` and its keepalive timer in `connections/keepalive.ts`; obs-auto-switcher's `modules/ws-server/` is named after the peer instead of a domain. In rest-api, `src/app.ts` builds the app and `modules/obs-nodes` and `modules/ingest-nodes` are the Hono reference: one `routes.ts`, a `schemas.ts`, and domain functions that take plain values. rest-api still keeps app-wide `routes/` (eventsub, clip sync and backups handlers, which still take `Context`), `jobs/` and `schemas/` (env, Proxmox webhook) folders, and `src/env.ts`; `lib/platform-events.ts` and `lib/user-state.ts` each belong to one module. streamwizard-bot still has `functions/`, an app-wide `handlers/`, domain code in `lib/` and `overlay-ws-client.ts` at the `src/` root, and its `index.ts` holds the shard wiring and health server. discord-bot keeps its domains in `lib/` (`tickets/`, `voice/`, `announcements/`, `log-channel/`, `server-log/`, plus loose `ticket-*.ts`) instead of `modules/`. alert-worker's loop lives in `src/worker/`. New code follows the layout above: don't add files to rest-api's `routes/`, `jobs/` or `schemas/`. Move existing files when you are already working on them, or in a dedicated restructure PR per app.

### Startup, shutdown and health

- **Sentry starts before anything else** through `bun --preload ./src/sentry.ts` in both the `dev` and `start` scripts. The first lines of `index.ts` register `uncaughtException` → `reportFatal` and `unhandledRejection` → `Sentry.captureException`. Imports are evaluated before those lines run, so keep work that can throw out of module scope.
- **A failed startup is reported:** catch it around `main()`, `captureException`, `await flushSentry()`, `process.exit(1)`.
- **SIGINT and SIGTERM run one `shutdown`:** stop the HTTP/WS server, disconnect clients, stop each job (a loop finishes its in-flight pass first), flush anything buffered (`flushTracking()`, log groups, counters), then `await flushSentry()` and `process.exit(0)`. Every `start*()` job has a matching `stop*()` that `shutdown` calls.
- **Every service serves `GET /health` on its own port**, liveness only: it answers while the process runs and never checks Supabase, Discord, Twitch or another service, so an outage elsewhere can't make the orchestrator restart it in a loop. The Dockerfile `HEALTHCHECK` curls it. A worker may answer 503 only when its own loop stopped finishing passes.
- **Interval loops use an interruptible sleep**, so `stop()` doesn't wait out a full interval. Several services keep their own copy of this helper today; extract it to a package instead of adding another.

### REST API (`apps/rest-api`)

Hono. `src/app.ts` builds the app (middleware order and route mounting); `src/index.ts` only starts the server and jobs. Domains in `src/modules/`: eventsub, streams, obs-nodes, ingest-nodes, discord-live, backups. Some handlers still sit in the legacy `src/routes/` and pollers in `src/jobs/` (see Current state above). Shared node field schemas (`claimToken`, `parseUuid`, ...) used by both node modules are in `src/lib/node-schemas.ts`. Use the existing `src/middleware/` for auth; do not hand-roll it in a route.

### Twitch bot and EventSub

`apps/streamwizard-bot` handles EventSub events and chat, then forwards overlay events to ws-server. `stream.online` and `stream.offline` arrive only through the rest-api webhook. Transport code belongs in `@repo/twitch-eventsub`, Helix calls in `@repo/twitch-api`.

### WebSocket service (`apps/ws-server`)

Roles: `subscriber` (overlay browser sources), `bot`, `consumer`, `ingest-node` and `monitor`. Bot, consumer, ingest-node and monitor connections, and the `/internal/*` HTTP routes, authenticate with service tokens checked against `WS_SERVICE_JWKS` (a monitor token is signed by web-admin for an admin's browser). Message and event types live in `@repo/types`, and every frame and `/internal/*` body is parsed with the schemas in `@repo/schemas/ws-server` (a bad frame is dropped, counted and logged once; a bad body gets a plain 400); the server-to-server HTTP client for the internal endpoints is `@repo/ws-client`. Treat `src/modules/connections/` (upgrade and socket lifecycle) and `@repo/types` as the source of truth for roles and message shapes. Each module owns its HTTP routes (`routes.ts`), its socket messages (`socket.ts`) and its timers (`jobs.ts`); `src/app.ts` mounts the routes.

### Discord bot (`apps/discord-bot`)

Files in `src/commands/` and `src/events/` are auto-discovered by `src/handlers/`; adding a file registers it. Run `bun run deploy-commands` after changing slash command definitions. `src/http/` exposes internal routes for trusted callers.

### Auto switcher and alert worker

Independent long-running Bun services. The alert worker runs `@repo/alerting`; rule and notification state goes through `queries/alerts*`.

## Observability

- Errors go to Sentry through each app's `src/sentry.ts` (built on `@repo/sentry`), preloaded with `bun --preload` so it initialises before any other module loads, or the Next `sentry.*.config.ts` and `instrumentation*.ts` files. rest-api is the exception: `@sentry/hono`'s `sentry(app, …)` middleware in `index.ts` initialises the SDK and must be the only init, so rest-api's `sentry.ts` only re-exports the SDK, and errors thrown while its modules load are not captured.
- Product events go through `@repo/posthog`; metrics through `@repo/metrics`.
- Operational events that admins or Discord log channels should see go through the platform events queue (`queries/platform-events`).
