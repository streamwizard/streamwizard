---
paths:
  - "packages/ttl-cache/**"
  - "**/*cache*.ts"
  - "**/rate-limit*.ts"
  - "apps/rest-api/src/**"
  - "apps/ws-server/src/**"
  - "apps/obs-auto-switcher/src/**"
  - "apps/discord-bot/src/**"
  - "apps/streamwizard-bot/src/**"
  - "apps/alert-worker/src/**"
---

# Caching

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md); this page has the detail.

`@repo/ttl-cache` is the one in-process cache. Use it for anything that remembers a value for a while: lookups, negative results, cooldowns, fixed-window counters.

**Server-side only:** Bun services, and in the Next apps server actions, route handlers, server components and `src/lib` code that only runs on the server. Never import it in a `"use client"` component or a hook a client component uses: in the browser it would be one throwaway copy per tab, and its point (sparing Supabase and Twitch) is lost. On the client, cache fetched data with SWR (web-admin) and keep UI state in component state or a zustand store (web-streamwizard).

- **`TtlCache<V>({ ttlMs, negativeTtlMs?, maxEntries?, now? })`**: bounded (oldest entry evicted first, default 5000), lazy expiry (no timers to leak).
- **Read-through:** `cache.fetch(key, loader)` collapses concurrent misses into one `loader()` call. A `null` result is cached for `negativeTtlMs` (pass `0` to not cache misses); a thrown error is never cached.
- **`get()` returns `undefined` for "not cached" and `null` for a cached miss.** Check `!== undefined`, not truthiness.
- **Cooldowns:** `set(key, true, { ttlMs })` or `{ expiresAt }`; "still cooling down" is `get(key) !== undefined`.
- **Fixed-window counters** (rate limits, lookup budgets): store `{ count }` with `ttlMs` = the window and increment in place. `MissLimiter` (`@repo/ttl-cache/miss-limiter`) is the ready-made version for failed lookups.
- **Clocks:** pass `now` when the surrounding code has an injectable clock, so tests can advance it. Otherwise the default `Date.now` follows `setSystemTime` in `bun test`.
- **Not a cache:** state that must be iterated or never expires (rooms, socket registries, a live-node list, config loaded from the DB) stays a plain `Map`.
- Caches are per process. Several replicas each hold their own copy, so N replicas allow N times any limit.
