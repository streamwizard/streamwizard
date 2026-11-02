# ws-server

The real-time overlay event bus. One Bun WebSocket server that fans Twitch events and IRL GPS out to every overlay that's listening — not just an IRL relay, the single pipe all live overlay data flows through.

## How it works

Three connection roles share one server, each authenticated differently:

| Role | Auth | Who it is |
|------|------|-----------|
| `publisher` | Supabase JWT *or* `overlay_scenes.subscriber_token` | The GPS overlay page sending on-device GPS. One per user room. |
| `subscriber` | `overlay_scenes.subscriber_token` | An OBS overlay. Many per user room. |
| `bot` | `Bearer <service token, scope bot>` | `streamwizard-bot` and `obs-auto-switcher` — persistent connections that push events into users' rooms. |
| `consumer` | `Bearer <service token, scope consumer>` | `obs-auto-switcher` — the firehose of every user's events. |
| `ingest-node` | `Bearer <service token, scope ingest-node>` signed by rest-api, with the node in its `node` claim | one ingest node: live session stats and NIC bandwidth. |

### Service tokens

Our own services authenticate with 60-second Ed25519 tokens, one per action
(`packages/service-token`). Each service signs with its own
`WS_SERVICE_SIGNING_JWK`; ws-server holds only the public keys in
`WS_SERVICE_JWKS` and checks every action (`broadcast`, `revoke`, `consumer`,
`bot`) against `SERVICE_POLICY`. The same tokens gate `POST /internal/broadcast`
and `POST /internal/revoke`.

The old shared secrets (`CONSUMER_SECRET`, and the service-role key for bots)
are still accepted until `WS_SERVICE_AUTH_REQUIRED=true`. Ingest nodes still log
in as bots with the service-role key, so turn that on only where no ingest
node connects. Generate keys per environment with
`bun packages/service-token/scripts/generate-keys.ts <out-dir>`.

### Ingest nodes

An ingest node gets a 60-second `ingest-node` token from rest-api
(`POST /api/ingest-nodes/me/ws-token`) before every dial and connects with
`role=ingest-node`. It never names a user or its own node: the node comes from
the token, and each `ingest_stats` sample only names a session id. ws-server
turns that into the user, stream key and label through its session registry
(`src/ingest-sessions.ts`), which rest-api fills with
`POST /internal/ingest-sessions` and `POST /internal/ingest-sessions/:id/end`
(scope `ingest-sessions`). Samples for a session the node didn't open, or
that has ended, are dropped.

On a miss the registry looks the session up once in `ingest_sessions` (misses
are remembered for 5s, one lookup per id at a time, and each node gets at most
20 lookups per 10s, so junk ids can't load the database). That lookup is what makes
the registry correct, not an optimisation: a restart empties the map while
nodes keep streaming, and with more than one replica a registration only
reaches one of them.

### Connection URL

```
ws://<host>/ws?role=<publisher|subscriber|bot>&token=<token>&channels=<comma-separated-event-types>
```

`channels` is optional for subscribers — leave it off to receive every event type.

Event types are Twitch EventSub strings (`channel.follow`, `channel.subscribe`, `channel.raid`, …) plus internal ones (`streamwizard.geo`, `streamwizard.status`). The full wire format, role auth, and bot integration are documented in the root [`ARCHITECTURE.md`](../../ARCHITECTURE.md).

## Internal structure

- `src/index.ts` — the `Bun.serve` entry point.
- `src/handlers/auth.ts` — the upgrade handshake and role auth.
- `src/handlers/ws.ts` — message handling.
- `src/rooms.ts` — per-user room membership and fan-out.

## Running locally

From the repo root:

```bash
bun dev --filter=@repo/ws-server
```

Listens on port `8000` (override with `PORT`).
