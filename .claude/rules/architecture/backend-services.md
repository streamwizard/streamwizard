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
  index.ts             starts the process only: env, Sentry, listen, start jobs. No logic.
  app.ts               builds the Hono app / WS server and mounts each module's routes (importable in tests)
  sentry.ts
  lib/env.ts           env schema (rest-api's src/env.ts is a legacy exception)
  modules/<domain>/    one folder per business domain: eventsub/, ingest-nodes/, rooms/, ...
    routes.ts          entry point: a Hono sub-app mounted with app.route(), or WS message handlers.
                       Parses and validates input, calls the domain, returns the response.
    <feature>.ts       domain logic: plain values in, plain values out
    schemas.ts         Zod schemas for this domain's input
    jobs.ts            pollers/sweepers that belong to this domain
    *.test.ts          next to the file they cover
  middleware/          cross-cutting HTTP guards only: auth, rate limits, security headers
  lib/                 generic helpers with no domain (secret-compare, r2 client)
  types/<domain>.ts    exported app-wide types (see types.md; shared contracts go in @repo/types)
```

The three layers, per domain:

| Layer | Where | Job |
|-------|-------|-----|
| Entry point | `modules/<domain>/routes.ts` (or WS handlers, job runners) | Adapt the request to plain values, validate, call the domain, shape the response. |
| Domain | `modules/<domain>/*.ts` | Business logic. Knows nothing about HTTP or WebSockets. |
| Data access | `@repo/supabase/queries/*` (shared) | All database calls. |

Rules:

- **Group by domain, not by technical role.** No app-wide `routes/`, `controllers/`, `services/` or `jobs/` folders; a domain's routes and jobs live in its module.
- **Never pass Hono `Context` or `Request`/`Response` into domain code.** Read what you need in `routes.ts` and pass plain values, so the logic is testable and reusable from jobs and other transports. (In ws-server the connection registries hold sockets by design; that's their domain.)
- **Routes use `app.route()` with per-domain sub-apps, handlers written inline.** No Rails-style controller classes (they break Hono's type inference). If a handler must be shared, use `factory.createHandlers()` from `hono/factory`.
- **Modules talk through their public functions.** Don't reach into another module's internal files; if two modules need the same thing, it moves to `lib/` (generic) or a package (shared across apps).
- **No new files at the `src/` root** besides `index.ts`, `app.ts` and `sentry.ts`. Exported types go in `src/types/` ([types.md](types.md)).
- **A new domain gets a new `modules/<domain>/` folder**, even if it starts with one file.
- **File names are kebab-case.** Exception: discord-bot `events/` files are named after discord.js events.
- Framework folders are allowed when the framework needs them: discord-bot's `commands/`, `events/`, `handlers/` (auto-discovery) and `http/`. Domain logic those commands call still goes in `modules/`.

**Current state:** ws-server and obs-auto-switcher follow this layout (ws-server is the reference for a non-Hono server, obs-auto-switcher for a worker with no public routes). rest-api keeps app-wide `routes/` and `jobs/` folders, and several `modules/obs-nodes` and `modules/ingest-nodes` files take Hono `Context`. streamwizard-bot (`functions/`) still needs moving. New code follows the layout above; move existing files when you are already working on them, or in a dedicated restructure PR per app.

### REST API (`apps/rest-api`)

Hono. Domains in `src/modules/`: eventsub, streams, obs-nodes, ingest-nodes, discord-live, backups. Route files still sit in the legacy `src/routes/` and pollers in `src/jobs/` (see Current state above). Use the existing `src/middleware/` for auth; do not hand-roll it in a route.

### Twitch bot and EventSub

`apps/streamwizard-bot` handles EventSub events and chat, then forwards overlay events to ws-server. `stream.online` and `stream.offline` arrive only through the rest-api webhook. Transport code belongs in `@repo/twitch-eventsub`, Helix calls in `@repo/twitch-api`.

### WebSocket service (`apps/ws-server`)

Roles: `subscriber` (overlay browser sources), `bot`, `consumer`, `ingest-node` and `monitor`. Bot, consumer and ingest-node connections, and the `/internal/*` HTTP routes, authenticate with service tokens checked against `WS_SERVICE_JWKS`. Message and event types live in `@repo/types`; client helpers in `@repo/ws-client`. Treat `src/modules/connections/` (upgrade and socket lifecycle) and `@repo/types` as the source of truth for roles and message shapes. Each module owns its HTTP routes (`routes.ts`), its socket messages (`socket.ts`) and its timers (`jobs.ts`); `src/app.ts` mounts the routes.

### Discord bot (`apps/discord-bot`)

Files in `src/commands/` and `src/events/` are auto-discovered by `src/handlers/`; adding a file registers it. Run `bun run deploy-commands` after changing slash command definitions. `src/http/` exposes internal routes for trusted callers.

### Auto switcher and alert worker

Independent long-running Bun services. The alert worker runs `@repo/alerting`; rule and notification state goes through `queries/alerts*`.

## Observability

- Errors go to Sentry through each app's `src/sentry.ts` (built on `@repo/sentry`) or the Next `instrumentation*.ts` files.
- Product events go through `@repo/posthog`; metrics through `@repo/metrics`.
- Operational events that admins or Discord log channels should see go through the platform events queue (`queries/platform-events`).
