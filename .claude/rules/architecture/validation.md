---
paths:
  - "apps/*/src/**"
  - "packages/*/src/**"
---

# Input validation (Zod)

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md).

**Anything that crosses a boundary into our code is parsed with a Zod schema before it's used.** A boundary is any place data arrives that our own TypeScript didn't just create. Hand-written `typeof` checks and loose regexes don't count.

## What must be validated

| Input | Where |
|-------|-------|
| Server action arguments | first line of every action, even when only our own UI calls it |
| HTTP requests: path params, query string, headers you read, body | every route handler and Hono route |
| Webhooks (Twitch, Proxmox, OAuth callbacks) | the payload, after the signature check |
| WebSocket upgrade query (`role`, `token`, `channels`, ...) and every incoming message | ws-server, and any service client that receives messages |
| Calls from nodes, bots and our other services | internal routes too: a leaked key shouldn't be able to send anything it likes |
| Third-party API responses we depend on (Helix, Discord, Proxmox, Tailscale) | the fields we use, where a wrong shape would corrupt our data or crash a job |
| JSON columns read from the database (`jsonb` configs, overlay item configs, settings) | when read, because older rows may not match today's shape |
| Browser-side input: form fields, URL search params, `localStorage`, `postMessage` | before use in the client (UX); the server action validates again (authority) |
| Uploads | size, type and name, before storing anything |
| Environment variables | already handled by each app's `src/lib/env.ts` |

**Not needed:** arguments between our own typed functions, values we just built, and non-JSON database columns that come typed from the generated `Database` types.

## How

- **Parse, then use only the result.** `const parsed = schema.safeParse(input)`; on failure return; after that use `parsed.data`, never the raw input.
- **Fail early and cheaply.** Validate shape before any database lookup, network call or side effect, so junk input costs nothing.
- **On failure:** our own UI gets field-level messages it can show; nodes, services and third parties get a plain 400 with a generic message. Never echo Zod's full error, internals or the rejected value back to an untrusted caller.
- **Bound everything:** a `max()` on every string and array, `int()` plus `min()`/`max()` on numbers. Query-string numbers use `z.coerce.number()`.
- **Use Zod's built-in formats** (`z.uuid()`, `z.email()`, `z.url()`, `z.jwt()`, `z.iso.datetime()`, `z.enum([...])`) instead of hand-written regexes. When a custom pattern is needed (for example the 64-hex overlay token), define it once in the schemas file and reuse it.
- **Message kinds use `z.discriminatedUnion("kind", [...])`** (or `"type"`), so each kind gets its own fields.
- **Unknown keys:** `z.object` strips them by default, which is what most inputs want. Use `.strict()` where an extra key means a bug or an attack (node and service payloads).
- **Defaults and transforms belong in the schema** (`.default()`, `.transform()` for a CSV param), not in the code after it.

## Where schemas live

- **Bun services:** `modules/<domain>/schemas.ts`, next to the routes that use them ([backend-services.md](backend-services.md)).
- **Next apps:** `src/schemas/<domain>.ts`, shared by the form (client) and the server action (server).
- **Used by more than one app or package:** `@repo/schemas`, or the package that owns the data (overlay configs in `@repo/ui`).
- **Types come from the schema** (`z.infer<typeof schema>`) and stay in the schema file ([types.md](types.md)). Never write the same shape twice as an interface and a schema.
- **One Zod major version** across the repo (`import { z } from "zod"`, Zod 4).

## Tests

Schemas that guard security-relevant input (auth, tokens, node and service payloads, uploads) get a test: valid input passes, and each kind of bad input (missing field, wrong type, too long, extra key where `.strict()`) is refused ([testing.md](testing.md)).

**Current state:** several boundaries still validate by hand, for example the ws-server upgrade query and internal route bodies (`typeof` checks, a UUID regex copied in three files). Move them to schemas when you touch the file.
