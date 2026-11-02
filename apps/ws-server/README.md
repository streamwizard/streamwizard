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
