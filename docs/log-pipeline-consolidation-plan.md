# Log pipeline: consolidation (review steps 3 and 4)

Follow-up to `docs/log-pipeline-fixes-plan.md`. Bugs and migrations are done; this removes the
duplicated helpers the review found. Four mechanical passes, each independently shippable and
each ending with the same checks: `bunx tsc --noEmit` in the touched apps and `bun test` in
`apps/discord-bot` and `packages/ttl-cache`.

## Pass A: `@repo/ttl-cache` (done 2026-09-15)

Seven hand-rolled TTL caches, none with single-flight except the one in rest-api.

| Site | Today | After |
|---|---|---|
| `apps/rest-api/src/lib/ttl-cache.ts` (+ test) | `TtlCache` class: lazy expiry, negative caching, bounded, stampede-safe `fetch()` | moves to `packages/ttl-cache/src/index.ts`, test moves with it |
| `packages/twitch-assets/src/cache.ts` | `memoryGet` / `memorySet` map | `new TtlCache({ ttlMs: per-entry })`: the entries carry their own `expiresAt`, so add an optional `ttlMs` override on `set(key, value, { ttlMs })` |
| bot `lib/permissions.ts` | `Map<key, {roleIds, expiresAt}>` | `TtlCache<string[]>({ ttlMs: 5 min })`, `fetch(key, loader)`; `invalidate*` become `cache.delete` / prefix clear |
| bot `lib/activity-tracker.ts` | `settingsCache` map | `TtlCache<TrackingContext>({ ttlMs: 60 s })` |
| bot `lib/ticket-activity.ts` | `admins` + `openTickets` | two caches; `trackTicketChannel` keeps mutating the cached map (that's fine, `get` returns the live object) |
| bot `lib/server-log/emit.ts` | `linkCache` | `TtlCache<LinkedAccount>({ ttlMs: 5 min })` (see pass B for what it caches) |
| bot `lib/log-channel/worker.ts` | `routingCache` | `TtlCache<LogRouting[]>({ ttlMs: 60 s })`, single key `"all"` |

Package: `packages/ttl-cache/{package.json,tsconfig.json,src/index.ts,src/index.test.ts}`,
copied from `packages/logger` for the boilerplate. rest-api imports change from
`./lib/ttl-cache` to `@repo/ttl-cache`. Prefix invalidation for permissions
(`invalidateGuildPermissionCache`): add `deleteWhere(predicate: (key) => boolean)` to the class.

Also fixes, for free: the `linkCache` map that never evicted; permissions retry after a failed
read (already fixed by hand, `fetch()` guarantees it).

## Pass B: one identity query (done 2026-09-15)

Five fetchers of the same three rows (`users`, `integrations_twitch`, `integrations_discord`):

- `getPlatformEventIdentity` (`queries/platform-events.ts`)
- `getPlatformEventIdentityByTwitchUserId` (same file)
- `linkedAccount` (bot `server-log/emit.ts`, private)
- `getConnectionInfo` (bot `lib/welcome.ts`) and `getPublicTwitchIntegrationByDiscordUserId`,
  `getLinkedStreamWizardAccount` (`queries/discord.ts`)
- `getUserDisplayProfile` (`queries/user.ts`)

And `platform_event_identity(uuid)` in SQL, which is now the rule of record.

Plan:
1. `packages/supabase/src/queries/identity.ts` (new):
   `getUserIdentity(client, by: { userId } | { discordUserId } | { twitchUserId })` returning
   `{ userId, displayName, email?, avatarUrl, twitch: { id, username, profileImageUrl, broadcasterType } | null, discord: { id, username } | null } | null`.
   One query per shape (the by-discord and by-twitch forms resolve `user_id` first, then the
   same three-row select). Pure mappers next to it: `toPlatformEventIdentity(row)` (the same
   rule as SQL: display name only without Twitch and not an email), `toPublicTwitchIntegration(row)`.
2. `getPlatformEventIdentity` and `...ByTwitchUserId` become thin wrappers; `platform-events.ts`
   keeps its exports so callers don't change.
3. Bot `emit.ts`: `linkedAccount` = `TtlCache.fetch(discordUserId, () => getUserIdentity(supabase, { discordUserId }))`.
   No `...ByDiscordUserId` helper needed: the ticket emitter goes through `emitServerEvent`, which
   links `subjectDiscordId`/`actorDiscordId` via that same cache.
4. `welcome.ts` `getConnectionInfo` and `queries/discord.ts` fetchers call `getUserIdentity`;
   delete the private selects. `getUserDisplayProfile` stays as a mapper over it.
5. Not in scope: replacing the TS rule with an RPC to `platform_event_identity`. The grant is
   there if wanted later; keep TS and SQL side by side for now and note the rule in both.

## Pass C: one never-throw emit (done 2026-09-16)

Four copies of "emit, report on error, never throw": web-admin `lib/platform-events.ts`,
rest-api `lib/platform-events.ts`, bot `server-log/emit.ts`, twitch-api `token-refresh-log.ts`
(which only `console.error`s).

1. `packages/supabase/package.json`: add `@repo/sentry` (no cycle: sentry depends on
   `@sentry/core` and supabase-js only).
2. `queries/platform-events.ts`: `logPlatformEvent(client, event, context: string): Promise<void>`
   that calls `emitPlatformEvent` and `reportError(error, context, { type })` on failure.
   `emitPlatformEvent` keeps returning `{ error }` for callers that want to decide.
3. web-admin keeps `eventIdentity` / `actorIdentity`, deletes its `logPlatformEvent`; rest-api
   keeps `logStreamOnlineFailed`, deletes its wrapper; bot `emitServerEvent` calls the shared
   one; `token-refresh-log.ts` uses `reportError` (add `@repo/sentry` to `packages/twitch-api`).
4. Also in this pass, because it's the same file: `emit_twitch_token_refresh_failed` takes
   `pg_advisory_xact_lock(hashtext(v_user_id::text))` before the EXISTS, and `refreshUserToken`
   in `base-client.ts` single-flights per broadcaster (`Map<string, Promise<string | null>>`).
   Closes the "dedupe that doesn't dedupe" item.

Outcome: `logPlatformEvent(client, event, context, extra?)` in `queries/platform-events.ts`;
web-admin `lib/platform-events.ts` keeps only the identity helpers, rest-api keeps only
`logStreamOnlineFailed`; the bot and twitch-api use `reportError`. The lock is a new migration
(`20260916100000_token_refresh_dedupe_lock.sql`, namespaced two-key `pg_advisory_xact_lock`);
`refreshUserToken` single-flights through a static map on `TwitchApiBaseClient`. `sendTestLogEvent`
in web-admin still calls `emitPlatformEvent` directly on purpose: it surfaces the error to the admin.

## Pass D: `emitAuditedEvent` and embed-kit helpers (done 2026-09-16)

### D1. The audit ritual (12 copies in `events/server-log/*.ts`)

```ts
// lib/server-log/emit.ts
export async function emitAuditedEvent<T extends PlatformEventType>(
  guild: Guild,
  type: T,
  audit: { type: AuditLogEvent; targetId?: string | null; channelId?: string | null; where?: ... } | null,
  payload: Omit<ServerPayload<T>, "moderator" | "reason">,
  options: EmitOptions = {},
): Promise<void>
```
Does: `isServerEventEnabled` check, `findAuditEntry`, return on `bySelf`, spread
`moderator`/`reason`, set `actorDiscordId`, then `emitServerEvent`. Files shrink to the payload:
`channelCreated`, `channelDeleted`, `channelUpdated`, `roleCreated`, `roleUpdated`, `roleDeleted`,
`serverUpdated`, `memberBanned`, `memberUnbanned`, `messageDeleted`, `messagesBulkDeleted`, and
the three branches of `memberUpdated`. `memberLeft` keeps its two-lookup shape (kick vs ban).

Also here: `isLoggedChannel(guild, channelId, parentId)` extracted from `shouldLogMessage` and
used by `messagesBulkDeleted`, which today skips the ignored-channel and open-ticket checks.

### D2. Embed helpers

Move into `lib/log-channel/embed-kit.ts` and delete the copies:

| Helper | Replaces |
|---|---|
| `memberName`, `who` (→ `discordUser`), `withMember` | same three in `server-formatters.ts`; `ticketWho`, `withTicketOpener` in `formatters.ts` |
| `describe(embed, lines)` | `summary` in server-formatters; four inline `truncate(lines.filter(Boolean).join("\n"), DESCRIPTION_MAX)` in formatters |
| `codeList(items)` | `permissionList`, attachments, `replaced_plan_ids` |
| `plain(text)` | eight `x ? escapeMarkdown(x) : null` |
| `duration()` becomes a null-guarding wrapper over `activity-format.ts` `formatDuration`; `formatNumber` replaces three `toLocaleString("en-US")` | |
| `truncate` used by `refs.ts` `messageText` and the bulk-delete line | two inline slice+ellipsis copies |
| `formatTicketNumber(n)`, `ticketChannelName(n)` in `packages/supabase/src/queries/tickets.ts` | six `padStart(4, "0")` copies (bot `tickets.ts` ×4, `formatters.ts`, web-admin `lib/discord/tickets.ts`) |
| `displayNameOf(user, member?)` in `refs.ts` | four different display-name expressions |

Existing formatter tests pin the output, so this pass is safe to do quickly: run `bun test`
after each move.

### D3. Error reporting (bot-wide, same pass)

Replace every `Sentry.captureException(...)` + `console.error(...)` pair in
`tickets.ts`, `welcome.ts`, `setup-wizard.ts`, `ticket-transcript.ts`, `activity-tracker.ts`
with `reportError(error, "discord-bot <area>", extra)`. `../sentry` stays imported only by
`index.ts` for init. Optional: move the try/catch from `server-log/handler.ts` into
`handlers/eventHandler.ts` so every listener gets it and `serverLogEvent` goes away.

Outcome: `emitAuditedEvent(guild, type, audit | null, payload | () => payload | null, options)` in
`server-log/emit.ts` (payload as a function keeps the channel and ticket checks behind the enabled
check; `fallbackReason` for bans); `isLoggedChannel` now also gates bulk deletes. Embed helpers
moved into `embed-kit.ts` (`memberName`, `discordUser`, `withMember`, `describeLines`, `codeList`,
`plain`, `formatNumber`, `duration` over `formatDuration`); `formatTicketNumber` and
`ticketChannelName` in `packages/supabase/queries/tickets.ts` replace six padStart copies (web-admin's
`ticketLabel` gone); `displayNameOf` in `refs.ts`. Every `Sentry.captureException` + `console.error`
pair in the bot is `reportError` with a context tag and ids as extra; `../sentry` is imported by
`index.ts` only. The optional part was done too: `handlers/eventHandler.ts` wraps every listener in
the catch, `server-log/handler.ts` and `serverLogEvent` are gone, and the server-log handlers use the
same `{ name, execute } satisfies BotEvent` shape as the rest.

## Order

A (cache package) first: B and D both build on it. Then B, C, D in any order; D2 and D3 are
the largest diffs but purely mechanical. Roughly a day for all four.

## Not in this plan (web-admin, review step 5)

`discordAction()` wrapper for the ten actions, `useSettingsForm` hook, `settings.ts` mappers,
list-page scaffolding, Discord profile cache under auto-refresh, `severity` on `EventMeta` to
replace the diverged DESTRUCTIVE set. Separate plan when the bot side is done.
