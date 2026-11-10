# rest-api

The API gateway. Twitch EventSub webhooks, clip sync, and analytics endpoints — built on [Hono](https://hono.dev/) over the [Bun](https://bun.sh/) runtime, so it stays fast even when a big stream dumps a burst of events on it.

## What it does

- **Twitch webhooks** — the HMAC-verified entry point for EventSub notifications.
- **Clip sync** — `src/modules/streams/clip-sync.ts` is the canonical sync, used by both the HTTP route and the `stream.offline` handler.
- **Analytics** — serves historical viewer-count data.
- **Auth** — Supabase-backed middleware on the user-facing endpoints.

## Key routes

- `POST /webhooks/twitch/eventsub` — entry point for all Twitch events.
- `POST /api/clips/sync` — manually trigger a clip sync.
- `GET /api/clips/sync-status` — current sync status.

EventSub notifications go through `src/modules/eventsub/registry.ts`, which dispatches to typed handlers in `src/modules/eventsub/handlers/`. All database access goes through `@repo/supabase/queries/*`; every Helix call goes through `@repo/twitch-api`.

## Layout

```
src/
  index.ts        starts the process: env, Sentry handlers, Bun.serve, background jobs, shutdown
  app.ts          createApp(): middleware chain in order, then each module's routes
  routes/         legacy handlers (EventSub webhook, clip sync, backups), mounted from app.ts
  env.ts          parses process.env against schemas/env.ts once at boot (legacy location)
  sentry.ts       preloaded before index.ts
  schemas/        legacy: env and Proxmox webhook schemas
  middleware/     HTTP middleware: user auth, OBS/ingest node auth, Twitch signature check, raw body, security/
  lib/            generic helpers (R2, ws-server, Tailscale keys, node field schemas, node token JWKS)
  jobs/           standalone background loops (asset reconciler, CMS scheduler, token validator)
  modules/
    backups/      PBS/PVE poller, cache, store, config
    discord-live/ go-live posts, live role, role sweeper
    eventsub/     routes.ts (webhook mount), handler registry, handlers/
    obs-nodes/
      routes.ts   every /api/obs-nodes route, /instances included
      schemas.ts  bodies an OBS node sends
      storage-credentials.ts  MinIO STS policies and credential cache
      node/       node-level domain code (claim, me, reconcile, plan limits, users, shared storage)
      instances/  domain code for one of the node's instances (CRUD, secrets, events, storage, stream key), create token, plan sweep
    ingest-nodes/ routes.ts, schemas.ts, domain code (claim, me, sessions, session-stats, ws-token)
    streams/      routes.ts (clip sync mount), clip sync, viewer-count poller, stream video lookup
```

The target layout is in [backend-services.md](../../.claude/rules/architecture/backend-services.md): a module's `routes.ts` reads and parses the request, calls plain domain functions (no Hono `Context`), and shapes the response. Zod schemas for a module's input live in its `schemas.ts`; Twitch EventSub schemas come from the shared `@repo/schemas` package. Tests sit next to the file they cover.

## Development notes

**EventSub webhooks are disabled in development** (`NODE_ENV=development`). Twitch requires HTTPS for webhook delivery, which your local HTTP setup can't provide, so the `POST /webhooks/twitch/eventsub` route isn't registered.

EventSub **WebSocket** transport (`packages/twitch-eventsub`) is unaffected and works everywhere.

## Running locally

From the repo root:

```bash
bun dev --filter=@repo/rest-api
```

Listens on port `8080` (override with `PORT`).
