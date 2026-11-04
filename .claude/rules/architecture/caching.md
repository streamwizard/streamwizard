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
  - "apps/web-*/src/actions/**"
  - "apps/web-*/src/app/api/**"
  - "apps/web-*/src/lib/**"
  - "packages/alerting/src/**"
  - "packages/twitch-assets/src/**"
  - "packages/twitch-api/src/**"
---

# Caching

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md); this page has the detail.

`@repo/ttl-cache` is the one in-process cache. Use it for anything that remembers a value for a while: lookups, negative results, cooldowns, fixed-window counters.

**Server-side only:** Bun services, and in the Next apps server actions, route handlers, server components and `src/lib` code that only runs on the server. Never import it in a `"use client"` component or a hook a client component uses: in the browser it would be one throwaway copy per tab, and its point (sparing Supabase and Twitch) is lost.

- **Client code:** fetched data is cached with SWR (web-admin) or a module-level store read through `useSyncExternalStore` that dedupes in-flight requests (web-streamwizard, for example `components/overlays/widgets/custom/widget-cache.ts`); UI state stays in component state or a zustand store. Per-key cooldowns in overlay renderers are a `Map` in a ref that gets pruned past a size cap (`cooldownAllows` in the emote widget), because a browser source runs for a whole stream. These spare our own UI, not Supabase, so never rely on them for a server limit.

## Using `TtlCache`

- **`TtlCache<V>({ ttlMs, negativeTtlMs?, maxEntries?, now? })`**: bounded (oldest entry evicted first, default 5000), lazy expiry (no timers to leak).
- **Read-through:** `cache.fetch(key, loader)` collapses concurrent misses into one `loader()` call. A `null` result is cached for `negativeTtlMs` (pass `0` to not cache misses); a thrown error is never cached.
- **When `fetch()` doesn't fit** (the TTL comes from the loaded value, or in-flight lookups need a cap), use `get()` and `set(key, value, { expiresAt })` and keep a local `inFlight` `Map<string, Promise<...>>` next to the cache that deletes its entry in `finally`. Never re-implement the expiry or eviction itself.
- **`get()` returns `undefined` for "not cached" and `null` for a cached miss.** When the cache can hold `null` (negative results) or a falsy value (`0`, `""`), check `!== undefined`. A truthiness check is fine for `TtlCache<true>` sets and for caches that only ever store objects.
- **Cooldowns:** `set(key, true, { ttlMs })` or `{ expiresAt }`; "still cooling down" is `get(key) !== undefined`.
- **Fixed-window counters** (rate limits, lookup budgets): store `{ count }` with `ttlMs` = the window and increment in place. `MissLimiter` (`@repo/ttl-cache/miss-limiter`) is the ready-made version for failed lookups.
- **Clocks:** pass `now` when the surrounding code has an injectable clock, so tests can advance it. Otherwise the default `Date.now` follows `setSystemTime` in `bun test`.
- **Not a cache:** state that must be iterated or never expires (rooms, socket registries, a live-node list, a full mirror of a table kept current by a reconcile loop or pushes, like obs-auto-switcher's config store) stays a plain `Map`. Give it a size cap if its keys come from outside. Per-key lookups of DB config (a guild's ticket config, voice settings) are a cache and use `TtlCache`.
- Caches are per process. Several replicas each hold their own copy, so N replicas allow N times any limit.
