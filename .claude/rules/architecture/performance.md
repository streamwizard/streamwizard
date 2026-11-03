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
- **No tight polling of the database.** Anything checked more often than about once a minute is cached (`@repo/ttl-cache`, server-side) or pushed (ws-server broadcast) instead of re-queried.
- **No query per item in a loop.** Batch with `in(...)`, a join or an RPC.
- **Paginate lists** that can grow (clips, events, logs). Always set a limit.
- **Index what you filter and sort on**, in the migration that adds the query.
- **Count with `count: "exact", head: true`**, not by fetching rows.
- **No Supabase Realtime for things that can be pushed** through ws-server; realtime connections and their egress add up.

## Next.js

- **Fetch on the server, in parallel.** Load a page's data in its server components with `Promise.all`, not in a chain of `await`s or from the client after load.
- **Keep client components small.** `"use client"` on the leaf that needs it, so the rest stays server-rendered and out of the bundle.
- **No barrel imports in server components.** Import the file you need; a barrel pulls its whole folder into the bundle.
- **Heavy client-only code** (editors, charts, maps) loads with `next/dynamic`.
- **Images** go through `next/image` with explicit sizes; fonts through `next/font`.
- **Cache what doesn't change per request** with Next's caching and revalidate on write (`revalidatePath` / `revalidateTag`), instead of `force-dynamic` everywhere.

## Services

- **Timers run as slowly as the job allows** and say why in a comment. A reconcile loop that only heals rare misses can run every few minutes.
- **Memory stays bounded:** every in-memory map or cache has a size cap or expiry.
- **Long-running work** (syncs, exports, backfills) runs as a job with progress, not inside a request.
