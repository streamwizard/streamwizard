# streamwizard-bot

The chat bot and event processor. It holds a persistent connection to Twitch EventSub, answers chat commands, logs every event, and fans real-time events out to overlays.

## What it does

- **Chat commands** — listens to Twitch chat over EventSub and responds via `@repo/twitch-api`. Command lookups go through `@repo/supabase/queries/commands`.
- **Event processing** — handles follows, subs, gifts, raids, cheers, and stream state changes, validating each payload against shared schemas at the boundary.
- **Overlay fan-out** — after every non-chat event, `processTwitchEvent` resolves the broadcaster to a user and pushes the event to `ws-server`, which relays it to that user's overlays. Only connects to the WS server if `OVERLAY_WS_URL` is set.

## Internal structure

- `src/handlers/` — registration and dispatch (`eventHandler.ts` is the hub).
- `src/functions/` — the per-event business logic (what actually happens on a follow, a sub, a raid).

This is a connect-out service — it dials Twitch and the WS server rather than listening on a port of its own. See the root [`ARCHITECTURE.md`](../../ARCHITECTURE.md) for how it plugs into the event bus.

## Running locally

From the repo root:

```bash
bun dev --filter=@repo/streamwizard-bot
```
