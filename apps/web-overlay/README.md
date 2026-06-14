# web-overlay

The OBS browser source. This is what your viewers see on stream — overlay scenes rendered server-side so you don't drop frames during a raid. Built on the Next.js App Router.

## What it does

Takes the scenes you build in the dashboard (`web-streamwizard`) and renders them as a live canvas OBS can point a browser source at. Clip playlists, text, timers, IRL GPS widgets — all of it.

## How it's wired

- **`app/[overlayId]/page.tsx`** — the server-rendered canvas. `overlayId` is either an active overlay **slug** or a scene **UUID** (the UUID path skips the `is_active` check, for embed tooling).
- **Server Actions** (`app/actions/*`) — trusted reads via the service-role Supabase client (`@repo/supabase/next/admin`) and the shared `queries/*`. No end-user auth — OBS just loads a URL.
- **`app/api/video/route.ts`** — a same-origin proxy for clip video URLs so widgets can play them without CORS drama.
- **Widgets** — pure renderers live in `@repo/ui`; this app supplies the data containers (e.g. `ClipsWidgetContainer`) and registers them in `page.tsx`.

The widget container/renderer split and the overlay data rules are documented in the root [`ARCHITECTURE.md`](../../ARCHITECTURE.md).

> **Heads up:** this app runs a pinned, modified build of Next.js — see [`AGENTS.md`](./AGENTS.md). Check the bundled docs in `node_modules/next/dist/docs/` before assuming an API behaves the way the public docs say.

## Running locally

From the repo root:

```bash
bun dev --filter=@repo/web-overlay
```

Runs on [https://localhost:3001](https://localhost:3001) — it serves over **HTTPS** (`--experimental-https`) because OBS browser sources expect a secure origin.
