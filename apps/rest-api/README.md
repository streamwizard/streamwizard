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
  index.ts        app wiring: middleware, routes, background jobs
  routes/         HTTP routes, one file per mount point; node route files only
                  list routes, handlers live in modules/obs-nodes and modules/ingest-nodes
  env.ts          parses process.env against schemas/env.ts once at boot
  sentry.ts       preloaded before index.ts
  schemas/        zod schemas: env, request bodies, webhook payloads
  middleware/     HTTP middleware: user auth, OBS/ingest node auth, Twitch signature check, raw body, security/
  lib/            small helpers shared by several modules (R2, ws-server, user state, Tailscale keys)
  jobs/           standalone background loops (asset reconciler, CMS scheduler, token validator)
  modules/
    backups/      PBS/PVE poller, cache, store, config
    discord-live/ go-live posts, live role, role sweeper
    eventsub/     handler registry, handlers/
    obs-nodes/    route handlers (claim, me, instances, users, ...), stream keys, create token
    ingest-nodes/ route handlers (claim, me)
    streams/      clip sync, viewer-count poller, stream video lookup
```

A file goes in a module when only that feature uses it, and in `lib/` once two or more modules need it. Zod schemas for env and incoming bodies live in `schemas/`; Twitch EventSub schemas come from the shared `@repo/schemas` package. Tests sit next to the file they cover.

## Development notes

**EventSub webhooks are disabled in development** (`NODE_ENV=development`). Twitch requires HTTPS for webhook delivery, which your local HTTP setup can't provide, so the `POST /webhooks/twitch/eventsub` route isn't registered.

EventSub **WebSocket** transport (`packages/twitch-eventsub`) is unaffected and works everywhere.

## Running locally

From the repo root:

```bash
bun dev --filter=@repo/rest-api
```

Listens on port `8080` (override with `PORT`).
