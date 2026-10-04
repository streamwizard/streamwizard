# EventSub dashboard (web-admin) + N-shard bot

## Context
- `/eventsub` in web-admin is a "Coming soon" placeholder (`apps/web-admin/src/app/(monitor)/eventsub/page.tsx`).
- The bot runs **one** conduit WebSocket and binds the hardcoded shard `'0'` (`packages/twitch-eventsub/src/index.ts:466`). Nothing creates, resizes or health-checks the conduit, and the bot exposes no shard state.
- rest-api receives `stream.online`, `stream.offline` and `channel.update` over the webhook transport. The other 28 types come in over the conduit.
- Goal: the bot runs N shards, and a read-only dashboard stays readable at 1 shard or 100. Admin actions come later.
- Decisions made: **dashboard plus N-shard bot**, **read-only first**.

## Bugs found along the way (fixed in Phase 1)
- `updateConduitShards` calls the wrong endpoint. It should be `PATCH /eventsub/conduits {id, shard_count}`.
- Twitch answers the shard bind (`PATCH /eventsub/conduits/shards`) with 202 even when a shard fails; the failure is listed in `errors[]`. The receiver treats any 202 as bound, so a failed bind looks like a success.
- The `ConduitShard` types are stale: the status union only has enabled/disabled, and `connected_at`/`disconnected_at` are missing. `getConduitShards` and `getSubscriptions` read only the first page and drop `total`, `total_cost` and `max_total_cost`.
- `trackEventSubReceived` hardcodes `service: "rest-api"`, including when the bot calls it.
- WebSocket revocations never write the `eventsub_revocation` metric.
- The `eventsub:conduit:sync` script points at a file that does not exist. Remove it.

## Phase 1: Twitch API + receiver fixes
- In `packages/twitch-api/src/eventsub.ts`:
  - Add `updateConduit(id, shard_count)`, keeping the old name as a deprecated alias.
  - Fix the shard status union and transport fields.
  - Make `updateShardTransport` return `{data, errors}`.
  - Add a helper that reads all pages of `getConduitShards`.
  - Add `getSubscriptionsPage({status|type|user_id, after})`, returning totals and cost.
- In the receiver (`packages/twitch-eventsub/src/index.ts`, `types.ts`):
  - Add a `shardId` option, default `'0'`.
  - When our shard appears in `errors[]`, treat the bind as failed.
- Tests go in `apps/streamwizard-bot/src/lib/eventsub-receiver.test.ts`, using the existing fake Twitch built on `Bun.serve`.

## Phase 2: Shard manager
- Receiver: add `getStats()`, returning:
  - state, session id and session start;
  - last message time, keepalive interval and reconnect attempts;
  - cumulative counters for messages, notifications, keepalives, lost connections, migrations and revocations.
- New `packages/twitch-eventsub/src/shard-manager.ts` with `ConduitShardManager`:
  - `ensureShardCount()` raises the conduit's `shard_count` when it is too low and never lowers it.
  - It starts one receiver per shard id, staggered 250 ms apart so N receivers don't refresh the app token at once.
  - It offers `snapshot()` and a 30 s heartbeat callback.
  - Lifecycle events are tagged with the shard id.
- Tests:
  - N receivers each bind their own id.
  - The shard count grows but never shrinks.
  - Connects are staggered.
  - Counters move.

## Phase 3: Bot wiring + telemetry
- In `apps/streamwizard-bot/src/lib/env.ts`, add `EVENTSUB_SHARD_COUNT` (default 1, so nothing changes until it is set). Add an optional `EVENTSUB_SHARD_IDS` (`0-9` or `0,2,4`) for splitting shards across processes by hand.
- In `apps/streamwizard-bot/src/index.ts`, replace the single receiver with the manager. Each shard gets its own `createEventSubLogger(shardId)` and telemetry, because the logger holds state per stream.
- Add `shard_id?` to the `EventSubEvent` payload types in `packages/types/src/platform-events.ts`, and show it in the Discord log formatter.
- In `packages/metrics/src/eventsub-metrics.ts`:
  - `trackEventSubReceived(service, type, handled, transport)`. No `shard_id` here, which keeps cardinality low.
  - `trackEventSubRevocation(service, type, transport)`, now also called from the bot.
  - `trackEventSubConnection` gains a `shard_id` tag.
  - New measurement `eventsub_shard`, written every 30 s:
    - tags: `service`, `shard_id`;
    - fields: connected, state_code, message and notification deltas, last_message_age_ms, reconnect_attempts, session_age_s, conduit_missing;
    - `session_id` is a string field, never a tag.
- The alert query in `packages/metrics/src/queries/alert-queries.ts:336` must group by `shard_id` **in this same PR**. Otherwise the new tag merges every shard into one series. Treat a missing tag as `"0"`.
- Update the callers in rest-api (`routes/twitch-eventsub.ts`) to the new signatures.

## Phase 4: Alerts
All in `packages/alerting/src/rules/api.ts`, with the new thresholds in `thresholds.ts`.
- `eventsub.disconnected`: set `entityId` to `service#shardId` so each shard alerts on its own, e.g. "shard 7 reconnecting for 5m".
- New `eventsub.heartbeat_stale` (crit): no `eventsub_shard` point for 3 minutes means the bot process is dead.
- New `eventsub.shards_degraded` (warn): at least X% of shards are down. When many shards drop at once, this sends one alert instead of N.
- Add tests in `rules.test.ts`.

## Phase 5: Admin data layer
- web-admin:
  - Add the `@repo/twitch-api` dependency.
  - Add `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` to `lib/env.ts` and to Doppler `dev_web_admin`, plus the stg and prd configs.
  - Get the app token from `getTwitchAppToken()` (`packages/supabase/src/index.ts:91`).
- Move the lists of webhook and conduit subscription types out of `apps/web-streamwizard/.../needed-event-subscriptions.ts` into `packages/types/src/eventsub-subscriptions.ts`, so both apps share them.
- New `packages/metrics/src/queries/eventsub-queries.ts`:
  - latest point per shard;
  - throughput per shard (for sparklines and the heatmap);
  - events by type, handled vs unhandled;
  - webhook vs WebSocket series;
  - connection counts per shard;
  - revocations.
- New `apps/web-admin/src/lib/eventsub-metrics.ts`, following the Supabase loader pattern (`fetchEventsubMetrics`, `EMPTY_EVENTSUB_METRICS`):
  - Conduit and shards from Helix, cached 30 s with `@repo/ttl-cache`.
  - Subscription inventory, cached 5 min. Helix `total` is app-wide whatever the filter (checked 2026-09-28: every filter returned the same total), so per-type and per-status counts come from one paged scan of all subscriptions (100 per call, capped at 100 pages; beyond that the inventory is marked partial). `total_cost` and `max_total_cost` come from the first page.
  - Influx queries.
  - `platform_events` rows of type `eventsub.*`.
  - Every source is wrapped in `lib/settled.ts`, with an error flag per source, so the page still renders when one source is down.
- New `app/api/metrics/eventsub/route.ts`, gated with `getAdminSession()` (401 without one).

## Phase 6: Admin UI
The page is a server component with `force-dynamic`. It passes its data as `initialData` to a client component, `components/charts/eventsub-dashboard.tsx`, which polls through `useMetricsPoll` (`components/charts/chart-kit.tsx:128`).

Design rules:
- Use the admin's existing tokens and fonts, with dark mode as the main view.
- Status is always shown as a dot plus an icon plus text, never colour alone.
- Numbers use `tabular-nums`.
- Show a skeleton while loading (`PageSkeleton`) and `ChartEmptyState` when there is no data.
- Only the live dot animates, and it respects reduced motion.

Layout, top to bottom:
1. **Health banner** (`eventsub-health.tsx`): same `band()` and worst-status pattern as `supabase-health.tsx`, which lives on the `fix/admin-cache-hit-color` branch, so merge or rebase onto that first. Checks:
   - shards enabled out of total (from Helix);
   - Helix and the bot disagree about a shard;
   - heartbeat is stale;
   - conduit is missing;
   - `shard_count` is higher than the number of shards sending a heartbeat;
   - cost is above 80% of the maximum;
   - revocations in the last 24h;
   - silence.
2. **KPI row** (`StatCard`): shards up (x/N), events per minute, subscriptions enabled/total, cost/max, reconnects in 24h, revocations in 24h.
3. **Shard grid** (`eventsub-shard-grid.tsx`). It scales with N, and the view choice is stored in `lib/dashboard-prefs.ts`:
   - **N ≤ 12:** one tile per shard showing id, status, Helix state vs bot state, messages per minute, a sparkline, age of the last message, session age and reconnects.
   - **N > 12:** a dense strip of 20 px squares, one per shard. Unhealthy squares carry an icon glyph and a tooltip. Beside the strip, a "Problem shards" table lists only unhealthy shards, worst first.
   - **Heatmap toggle:** shards as rows, time buckets as columns, gaps marking outages. It still fits one screen at 100 or more shards.
   - Clicking a shard opens a `Sheet` with the Helix transport (session id, connected and disconnected times), bot stats, a `PlatformMetricChart` of throughput and that shard's lifecycle rows.
   - New `components/widgets/sparkline.tsx`, drawn as a plain SVG polyline because it is cheap to render 20+ times.
4. **Transport split:** `PlatformMultiSeriesChart` of webhook vs WebSocket volume. Webhook types are listed with badges.
5. **Subscription inventory:** a table of type × total with a transport badge, status totals (statuses other than enabled highlighted), and a cost bar with a "cached 5 min" note.
6. **Throughput by type:** the top N types stacked (`stackByTime`), plus a handled vs unhandled column.
7. **Lifecycle timeline:** recent `eventsub.*` rows (time, type, shard, reason, downtime), filterable by shard.

## Later: admin actions (not in scope)
Resize the conduit, force a shard rebind, resync one user's subscriptions, delete orphaned subscriptions. Each goes behind a confirm dialog and `assertAdmin()`.

## Open checks (answered 2026-09-28)
- The 3-connection limit is for plain WebSocket subscriptions made with a user token. Conduits are limited per app: 5 conduits, 20,000 shards each. Tested: 2 shards from one bot process both show `enabled` in Helix.
- A notification for a disabled shard is resent once to another shard, and dropped if that one is disabled too. Nothing is queued. Events sent before Twitch notices a silent drop are lost.

## Verification
- Run `bun test` in `apps/streamwizard-bot`, `packages/alerting` and `apps/web-admin`, then `bunx tsc --noEmit` in each app (turbo check-types skips the apps).
- Manual tests on the dev conduit:
  1. Start with `EVENTSUB_SHARD_COUNT=3`. `getConduitShards` should show 3 enabled shards with different session ids.
  2. Cut one socket. There should be one `connection_lost` row for that shard, and the alert should fire only for that shard.
  3. Force the count to 20. The dashboard should switch to the strip view.
- Open `/eventsub` locally at 375, 768 and 1440 px, in dark and light mode.
- After a day, check series counts on `eventsub_shard` and `eventsub_event` in Influx with `schema.tagValues`.
- Each phase is one PR against `staging`.
