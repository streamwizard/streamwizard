# @repo/ttl-cache

A bounded, per-process TTL cache with read-through and stampede protection. One class, no
dependencies.

```ts
import { TtlCache } from "@repo/ttl-cache";

const roles = new TtlCache<string[]>({ ttlMs: 5 * 60_000 });

// Read-through: N concurrent callers on a cold key run the loader once. A throwing
// loader is not cached, so the next caller retries.
const ids = await roles.fetch(`${guildId}:${command}`, () => loadRoles(guildId, command));

roles.delete(key);                                   // one entry
roles.deleteWhere((key) => key.startsWith(guildId)); // a prefix
roles.clear();                                       // everything
```

- Expiry is lazy (checked on read), so there is no timer to leak.
- `null` is a cached negative result (its own `negativeTtlMs`); `undefined` from `get()` means
  "not cached".
- Eviction is oldest-insertion-first at `maxEntries` (default 5000).
- `set(key, value, { ttlMs })` or `{ expiresAt }` overrides the TTL for one entry.
- `now` is injectable for tests.

Used by rest-api (node API keys), twitch-assets (asset memory layer) and the Discord bot
(permissions, activity settings, ticket lookups, linked accounts, log routing).
