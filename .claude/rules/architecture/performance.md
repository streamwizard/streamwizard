---
paths:
  - "apps/*/src/**"
  - "packages/*/src/**"
---

# Performance and Supabase egress

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md).

Supabase bills egress per request as well as per byte, so the cheapest query is the one you don't make.

## Database

- **Select only the columns you use.** No `select("*")` in query modules for tables with large or many columns.
- **Name the column list once:** a `<TABLE>_<PURPOSE>_COLUMNS` string constant next to the query (`OVERLAY_PLAYLIST_CLIP_COLUMNS`, `NODE_INSTANCE_COLUMNS`), so callers and tests share it. Rows read by services or admin pages never include secret columns (`*_ciphertext`, `*_hash`, tokens) unless the code decrypts or compares them right there.
- **No tight polling of the database.** Reads of data that only changes when someone edits it (config, commands, node registry, admin session checks) are cached with `@repo/ttl-cache` for at least a minute or pushed through ws-server, never re-queried per message, request or poll. Queue and scheduler claims (one indexed claim RPC or conditional `UPDATE` that usually returns nothing) may tick every 30 s; anything else that hits the DB runs once a minute or slower, and the interval's comment says why.
- **No query per item in a loop.** Batch with `in(...)`, a join or an RPC.
- **Paginate lists** that can grow (clips, events, logs). Always set a limit.
- **PostgREST returns at most 1000 rows per request (`max_rows`) and truncates silently.** A query whose result feeds a total, a leaderboard or a "latest per X" must aggregate in SQL (an RPC or a view) or page with `.range()` until a short page; never assume one `select` saw every row.
- **Index what you filter and sort on**, in the migration that adds the query.
- **Count with `count: "exact", head: true`**, not by fetching rows.
- **Realtime only for internal, low-fan-out feeds of DB rows** (web-admin ticket pages, the bot's `platform_events` queue wake-up), always with a fallback poll. Anything a streamer page or overlay shows live, and anything a service already sends to ws-server (EventSub events, widget state, OBS status), comes through ws-server, never `postgres_changes`. Realtime connections and their egress add up.

## Next.js

- **Fetch on the server, in parallel.** Load a page's data in its server components with `Promise.all`, not in a chain of `await`s or from the client after load.
- **Keep client components small.** `"use client"` on the leaf that needs it, so the rest stays server-rendered and out of the bundle.
- **No barrel imports in server components.** Import the file you need; a barrel pulls its whole folder into the bundle.
- **Heavy client-only code** (editors, charts, maps) loads with `next/dynamic` when it is not the page's main content: below the fold, behind a tab, dialog or toggle, or on public pages. A page that *is* the editor or chart may import it directly.
- **Images** go through `next/image` with explicit sizes. Plain `<img>` is allowed, with a one-line comment, for user uploads on our CDN, emote and third-party CDNs, images with no stored size, and OG/Satori output. Fonts go through `next/font`.
- **Public pages are cached:** static or `revalidate`, refreshed with `revalidatePath` / `revalidateTag` on write; `force-dynamic` only with a comment saying why. Signed-in dashboard pages and all of web-admin are dynamic by nature and need no justification.

## Services

- **Timers run as slowly as the job allows** and say why in a comment. A reconcile loop that only heals rare misses can run every few minutes.
- **Memory stays bounded:** every in-memory map or cache has a size cap or expiry.
- **Long-running work** (syncs, exports, backfills) runs as a job with progress, not inside a request.
