# rest-api

The API gateway. Twitch EventSub webhooks, clip sync, and analytics endpoints — built on [Hono](https://hono.dev/) over the [Bun](https://bun.sh/) runtime, so it stays fast even when a big stream dumps a burst of events on it.

## What it does

- **Twitch webhooks** — the HMAC-verified entry point for EventSub notifications.
- **Clip sync** — `src/functions/sync-twitch.ts` is the canonical sync, used by both the HTTP route and the `stream.offline` handler.
- **Analytics** — serves historical viewer-count data.
- **Auth** — Supabase-backed middleware on the user-facing endpoints.

## Key routes

- `POST /webhooks/twitch/eventsub` — entry point for all Twitch events.
- `POST /api/clips/sync` — manually trigger a clip sync.
- `GET /api/clips/sync-status` — current sync status.

EventSub handlers live in `src/handlers/eventHandler.ts`, which dispatches to typed handlers in `src/functions/twitch-eventsub-events/`. All database access goes through `@repo/supabase/queries/*`; every Helix call goes through `@repo/twitch-api`.

## Development notes

**EventSub webhooks are disabled in development** (`NODE_ENV=development`). Twitch requires HTTPS for webhook delivery, which your local HTTP setup can't provide, so the `POST /webhooks/twitch/eventsub` route isn't registered.

EventSub **WebSocket** transport (`packages/twitch-eventsub`) is unaffected and works everywhere.

## Running locally

From the repo root:

```bash
bun dev --filter=@repo/rest-api
```

Listens on port `8080` (override with `PORT`).
