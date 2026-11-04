# @repo/types

Shared TypeScript contracts used by more than one app or package. Types only: no constants, helpers or lookup tables (a type guard for one of its own types is the one allowed function), so importing it never adds runtime code to a bundle.

## Entry points

There is no `.` entry. Import the file you need by subpath (`"./*": "./src/*.ts"`):

- `@repo/types/eventsub`: Twitch EventSub messages, subscription types and metadata, transports, WebSocket frames.
- `@repo/types/helix`: Twitch Helix request params and responses (streams, clips, VODs, chatters).
- `@repo/types/irl`: the GPS sample (`GeoPayload`) IRL streams send.
- `@repo/types/overlay-ws`: ws-server overlay messages (`OverlayEventType`, `OverlaySocketMessage`, `BotBroadcastMessage`) and payloads.
- `@repo/types/monitor`: the frames ws-server sends to monitor sockets (`MonitorEnvelope`, `MonitorSnapshot`, `MonitorNodeBandwidth`, `IngestNodeLive`, `MonitorMessage`), read by web-admin.
- `@repo/types/platform-events`: platform event payloads (`PlatformEventPayloads`) and the Discord refs they use.

Runtime code that used to live here moved to the package that owns it:

- EventSub subscription lists and builders: `@repo/twitch-eventsub/subscriptions`.
- `WebSocketCloseCode`: `@repo/twitch-eventsub`.
- Platform event tables, `PlatformEventType` and helpers: `@repo/schemas/platform-events`.

## Usage

```typescript
import type { EventSubSubscriptionType } from "@repo/types/eventsub";
import type { Stream } from "@repo/types/helix";
```

This package reads no env variables.
