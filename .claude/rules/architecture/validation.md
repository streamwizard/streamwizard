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
| Server action arguments | right after the auth check (`tryAuthContext()`, web-admin's `admin-context.ts` helpers; web-overlay parses the token and item id first, then calls `resolveOverlayItem`), before any other database lookup, network call or side effect, even when only our own UI calls it |
| HTTP requests: path params, query string, headers you read, body | every route handler and Hono route |
| Webhooks (Twitch, Proxmox, OAuth callbacks) | the payload, after the signature check |
| WebSocket upgrade query (`role`, `token`, `channels`, ...) and every incoming message | ws-server, and any service client that receives messages |
| Discord interactions (button/select `customId`, modal fields, command options) | discord-bot: decode the `customId` with its namespace's parse helper (`lib/tickets/ids.ts`, `lib/built-buttons.ts`) and parse args and modal values with Zod before acting; never trust the ids inside a `customId` without re-checking ownership |
| Calls from nodes, bots and our other services | internal routes too: a leaked key shouldn't be able to send anything it likes |
| Third-party API responses we depend on (Helix, Discord, Proxmox, Tailscale) | the fields we use, where a wrong shape would corrupt our data or crash a job |
| JSON columns read from the database (`jsonb` configs, overlay item configs, settings) | when read, because older rows may not match today's shape |
| Browser-side input: form fields, URL search params, `localStorage`, `postMessage` | before use in the client (UX); the server action validates again (authority) |
| Uploads | size, type and name, before storing anything |
| Environment variables | already handled by each app's `src/lib/env.ts` |

**Not needed:** arguments between our own typed functions, values we just built, and non-JSON database columns that come typed from the generated `Database` types.

## How

- **Parse, then use only the result.** `const parsed = schema.safeParse(input)`; on failure return; after that use `parsed.data`, never the raw input.
- **Fail early and cheaply.** Validate shape right after authentication and before any other database lookup, network call or side effect, so junk input costs nothing.
- **Read bodies so bad JSON is a 400, not a 500:** in Hono, `schema.safeParse(await c.req.json().catch(() => null))` (discord-bot: `readJson(c)` from `src/http/validation.ts`). Never a bare `await c.req.json()`. Path params are parsed too (`z.uuid()`, discord-bot's `snowflake`).
- **On failure:** our own UI gets field-level messages it can show; nodes, services and third parties get a plain 400 with a generic message. Never echo Zod's full error, internals or the rejected value back to an untrusted caller.
- **Bound everything we accept from users, nodes, services and widgets:** a `max()` on every string and array, `int()` plus `min()`/`max()` on numbers. Query-string numbers use `z.coerce.number()`. Schemas that mirror a third party's documented payload (EventSub in `@repo/schemas/eventsub/*`) keep Twitch's limits where Twitch documents them and are otherwise unbounded; the transport limit (body size, WS frame size) caps them.
- **Use Zod's built-in formats** (`z.uuid()`, `z.email()`, `z.url()`, `z.jwt()`, `z.iso.datetime()`, `z.enum([...])`) instead of hand-written regexes. Ids use `@repo/schemas/ids`: `guidSchema` / `isGuid()` for database ids and route params (any 8-4-4-4-12 hex id, like our seed rows), `uuidSchema` / `isUuid()` only where the id is known to be an RFC UUID, `snowflakeSchema` for Discord ids, and `twitchClipIdSchema` / `isTwitchClipId()` for Twitch clip ids. Never write an id regex by hand. When another custom pattern is needed (for example the 64-hex overlay token), define it once in the schemas file and reuse it.
- **Message kinds use `z.discriminatedUnion("kind", [...])`** (or `"type"`), so each kind gets its own fields.
- **Unknown keys:** `z.object` strips them by default, and that is the default for node and service payloads too: list only the fields we accept, and say in a comment which keys a sender may send that we drop on purpose (for example `node_id` on instance writes). Use `.strict()` only on a new contract whose sender ships in the same deploy, or after every deployed sender has stopped sending the extra keys. Turning on `.strict()` for a live node contract is a breaking change with its own deploy order (node first, then rest-api).
- **Lenient reads of JSON columns:** where one bad field must not throw away the whole row (overlay item configs), read with the widget's `normalize<Widget>Config(raw: unknown)` in `@repo/ui`, which falls back to defaults field by field, or with a Zod schema using `.catch()` per field. Writes still go through the strict schema in `overlay-schemas.ts`. A plain `row.config as T` is never enough.
- **Defaults and transforms belong in the schema** (`.default()`, `.transform()` for a CSV param), not in the code after it.

## Where schemas live

- **Used by one file only:** at the top of that file, after the imports, not exported (same rule as local types in [types.md](types.md)). When a second file (or the client form) needs it, move it.
- **Bun services:** `modules/<domain>/schemas.ts`, next to the routes that use them ([backend-services.md](backend-services.md)). rest-api's existing `src/schemas/<domain>.ts` files move there with their module.
- **Next apps:** `src/schemas/<domain>.ts` once the form (client) and the server action (server) share it.
- **Used by more than one app or package:** `@repo/schemas`, or the package that owns the data (overlay configs in `@repo/ui`). `@repo/schemas` is grouped by domain, one subpath per file: EventSub payloads in `eventsub/<area>`, widget fixtures and data in `widgets/<file>`, the auto switcher in `auto-switcher/<file>`, and `streamwizard-events`, `platform-events` and `twitch-scopes` at the root. A new schema goes in the folder of its domain; there is no barrel to add it to. What ws-server receives (bot and ingest-node frames, `/internal/*` bodies) and what its consumers receive is in `@repo/schemas/ws-server`, parsed on both sides. The service key sets (`WS_SERVICE_JWKS`, `REST_API_SERVICE_JWKS`, `DISCORD_BOT_SERVICE_JWKS`) are checked by `@repo/service-token/jwks`.
- **Types come from the schema** (`z.infer<typeof schema>`) and stay in the schema file ([types.md](types.md)). Never write the same shape twice as an interface and a schema.
- **One Zod major version** across the repo (`import { z } from "zod"`, Zod 4).

## Tests

Schemas that guard security-relevant input (auth, tokens, node and service payloads, uploads) get a test: valid input passes, each kind of bad input (missing field, wrong type, too long) is refused, and an extra key is stripped (or refused, where the schema is `.strict()`) ([testing.md](testing.md)).

**Current state:** ws-server (upgrade query, socket frames, `/internal/*` bodies), obs-auto-switcher's consumer feed, rest-api's node routes (bodies, path and query ids) and the server actions in all three web apps parse with Zod. Other boundaries still validate by hand or not at all: the Next route handlers and a few rest-api routes outside the node modules. Nothing uses `.strict()`. Move them to schemas when you touch the file.
