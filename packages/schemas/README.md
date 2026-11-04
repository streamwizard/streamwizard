# @repo/schemas

Shared [Zod](https://zod.dev/) schemas, and the types inferred from them, for data that crosses a boundary: Twitch EventSub payloads, ws-server frames, StreamWizard's own WS events, widget test fixtures and the auto switcher config.

## Entry points

There is no `.` entry. Import the file you need by subpath (`"./*": "./src/*.ts"`):

- `@repo/schemas/eventsub/<type>`: the Twitch EventSub payload schemas, one file per area: `automod`, `channel`, `channel-points`, `chat`, `conduit`, `drops`, `extensions`, `guest-star`, `moderate`, `polls-predictions`, `stream`, `user`, and `misc` (hype train, goals, charity, shoutouts, shield mode, shared chat). `eventsub/shared` holds the pieces they share (badges, users, message fragments, currency amounts).
- `@repo/schemas/streamwizard-events`: payloads of the `streamwizard.*` events (overlay geo and status, OBS instance lifecycle and scene changes, ingest stats, user state updates).
- `@repo/schemas/ids`: shared id checks: `guidSchema` / `isGuid` (database ids, route params), `uuidSchema` / `isUuid` (RFC UUIDs only), `snowflakeSchema` / `isSnowflake` (Discord ids).
- `@repo/schemas/ws-server`: frames and `/internal/*` bodies ws-server receives, and the consumer feed it sends.
- `@repo/schemas/platform-events`: the platform event tables (`PLATFORM_EVENTS`, groups, statuses), `PlatformEventType` and its helpers (`isPlatformEventType`, `platformEventMeta`, ...). Payload types are in `@repo/types/platform-events`.
- `@repo/schemas/twitch-scopes`: the Twitch OAuth scope sets per feature and `twitchScopesFor` / `missingTwitchScopes`.
- `@repo/schemas/auto-switcher/auto-switcher`: auto switcher thresholds, config row and status schemas.
- `@repo/schemas/auto-switcher/constants`: the sensitivity presets, their wording and the default chat notices, with no Zod at runtime (safe for marketing pages).
- `@repo/schemas/auto-switcher/form`: the switcher settings form schema and its defaults.
- `@repo/schemas/widgets/<file>`: widget data and fixtures: `test-events` (the editor's Test buttons), `demo-events`, `simulator-steps`, `credits`, `stream-labels`, and the Monaco declarations `editor-declarations` (generated) and `editor-lib-declarations`.

## Usage

```typescript
import { StreamOnlineEventSchema } from "@repo/schemas/eventsub/stream";

const result = StreamOnlineEventSchema.safeParse(rawPayload);
if (result.success) {
  // result.data is now fully typed and validated
}
```

## Scripts

- `bun run generate:widget-declarations` regenerates `src/widgets/editor-declarations.ts` from the schemas.
- `bun run scripts/generate-widget-event-docs.ts` regenerates `apps/docs/widgets/api/events.mdx`.

This package reads no env variables and has no import-time side effects (`"sideEffects": false`).
