# web-streamwizard

The dashboard streamers actually log into. Clips, folders, overlays, analytics — the whole product lives here. Built on the Next.js App Router.

## What it does

- **Clips & folders** — organize your highlights by game, date, or vibe instead of whatever order Twitch dumped them in.
- **Overlay editor** — build and arrange overlay scenes that the OBS app (`web-overlay`) renders live.
- **Analytics** — viewer counts and stream history, in plain numbers.
- **Twitch connection** — OAuth, EventSub subscription registration, token handling.

## How it's wired

- **Route groups** — `(auth)` (public login + OAuth callback), `(protected)` (the authenticated dashboard), `(public)` (marketing/public pages), and `api/` (endpoints the overlay app reads).
- **Mutations** — every write goes through a Server Action in `src/actions/`. No ad-hoc API layer.
- **Database** — never queried directly. All `.from()` calls live in `@repo/supabase/queries/*`.

See the root [`ARCHITECTURE.md`](../../ARCHITECTURE.md) for the full routing, server-action, and overlay-widget breakdown.

## Development notes

**EventSub webhook subscriptions are skipped in development** (`NODE_ENV=development`). When `checkEventSubscriptions` runs on login, only conduit (WebSocket) subscriptions register. Webhook subscriptions (`stream.online`, `stream.offline`, `channel.update`) are skipped because Twitch requires HTTPS for webhook delivery — which your local HTTP setup doesn't have.

## Running locally

From the repo root (see the root [README](../../README.md) and [CONTRIBUTING](../../CONTRIBUTING.md) for full setup):

```bash
bun dev --filter=@repo/web-streamwizard
```

Then open [http://localhost:3000](http://localhost:3000).
