# Sentry log noise reduction plan

Goal: Sentry Logs holds only lines someone would act on. Routine chatter stays in
container output (Dokploy logs), which is free and already kept.

## Where we are (last 14 days, 2026-09-07 → 2026-09-21)

~1.35M log lines. Free plan includes 5 GB of logs a month; over that, logs are dropped.

| Source | Lines | Status |
|---|---|---|
| streamwizard-bot conduit shard loop (404 `conduit does not exist`, every ~12s, 5 lines per attempt, ~2 KB Axios dump on each warn/error) | ~730k | Stopped 2026-09-18, code unchanged |
| streamwizard-bot chat messages (`[channel] user: text`) | ~425k | Ongoing, and a privacy problem |
| alert-worker `[alerting] snapshot ok=…` every 15s tick, prod + staging | ~80k | Ongoing |
| web-overlay `[clips] slot N: …` debug lines, from every viewer's browser | ~50k | Ongoing |
| web-overlay Next.js `Failed to find Server Action` after deploys | ~1.5k | Ongoing |
| Token refresh info lines (web-streamwizard, rest-api) | ~650 | Ongoing |
| ws-server / obs-auto-switcher connect/disconnect lines | ~1k | Ongoing |

Every deployed app forwards `console.log/info/warn/error` to Sentry Logs
(`packages/sentry/src/index.ts:132`), including browser code in the three Next.js
apps. Logs get no scrubbing: `scrubEvent` runs in `beforeSend`, which only covers
error events, and there is no `beforeSendLog`.

## Logging policy (the rule the phases below enforce)

| Call | Goes to | Use for |
|---|---|---|
| `console.debug` | Local and container output only | Step-by-step tracing (clip slots, retries in progress) |
| `console.log` / `console.info` | Local and container output only | Routine lifecycle (connected, token refreshed, tick summary) |
| `console.warn` | Sentry Logs | Something degraded but recovered, or needs a look |
| `console.error` | Sentry Logs | Something failed |
| `Sentry.captureException` | Sentry Issues (error quota) | A bug or outage someone must fix. Must be rate-limited if it can happen in a loop |
| `Sentry.logger.info(...)` | Sentry Logs | The rare info event we deliberately want searchable in Sentry |

Never log: chat message text, viewer usernames, tokens, emails, full Axios error
objects (log `status` + `message`, not the config/request dump).

## Phase 0: urgent fixes (one small PR)

1. **Remove the chat log.** `apps/streamwizard-bot/src/handlers/eventsub/handleChatMessage.ts:9`.
   Viewer names and message text should not be stored anywhere we don't need them.
2. **Treat a conduit 404 as permanent.** `packages/twitch-eventsub/src/index.ts:411`
   (`updateConduitShard`):
   - On `404`, stop retrying. Emit `conduit_update_failed` once, then recreate the
     conduit (or stop and alert) instead of reconnecting every ~12s.
   - Find what drives the ~12s reconnect cycle after a failed bind, and back it off
     exponentially.
   - Log `status` + `message` only, not the whole Axios error.
3. **Rate-limit the conduit failure outputs added on staging.**
   `apps/streamwizard-bot/src/lib/eventsub-telemetry.ts:57` calls
   `Sentry.captureException` on every failure, and `eventsub-log.ts:88` writes a
   `platform_events` row (Discord post) on every failure. The Sept 7–18 outage would
   have produced ~81k Sentry errors and ~81k Discord posts. Report the first failure
   plus one per hour while it continues, the same approach as `shouldReportRuleError`
   in PR #249.

## Phase 1: global level policy (one PR, biggest win)

1. **Forward only warn + error.** `createConsoleLogsIntegration` in
   `packages/sentry/src/index.ts`: `levels: ["warn", "error"]`. This one line removes
   the chat, snapshot, clip, token-refresh and connect/disconnect lines from Sentry
   (well over 95% of current volume) while they keep printing locally.
2. **Scrub logs.** Add `beforeSendLog` to `getSentryOptions` that runs the existing
   `redactString` on the message and string attributes, so logs are cleaned like
   errors are.
3. **Drop known harmless noise in `beforeSendLog`:** `Failed to find Server Action`
   and `The Server Reference ID did not match` (stale overlays after a deploy). Match
   on the message; keep the list short and commented.
4. **Share one rate limiter.** Move the "report once, then hourly per key" helper into
   `@repo/sentry` (`reportThrottled(key, err)`) so alert-worker, the bot and future
   loops use the same thing instead of each writing their own.

## Phase 2: per-file cleanups (can ship with Phase 1)

These matter even after Phase 1, because container output has limits too, and some
of them will turn into warn/error lines later.

| File | Change |
|---|---|
| `packages/alerting/src/engine.ts:521` | Log the snapshot line only when `ok=false` or the counts change since the last tick; keeps the "registry quietly emptied" signal the comment wants |
| `packages/ui/src/components/overlay/widgets/clips/ClipsWidgetRenderer.tsx:172, 183, 208, 232, 257, 266, 362` | `console.log` → `console.debug`; drop the clip title from the message (it made one log group per title) |
| `apps/web-overlay/.../ClipsWidgetContainer.tsx:44, 71` and `No landscape_download_url` | Remember clips that fail to resolve and skip them for a while, instead of retrying and warning on the same few clips all day |
| `packages/twitch-api/src/base-client.ts:103, 191, 198` | Refresh-attempt / refreshed lines → `console.debug`; keep the failed-refresh error |
| `apps/web-admin` dashboard gate `getUser failed … Auth session missing!` | Not an error: a logged-out visit. `console.debug`, keep real `getUser` failures as warn |
| `apps/discord-bot` `[sentry] active` | Remove |
| ws-server `[subscriber] connected/disconnected userId=…` | Keep as info (local only after Phase 1); drop the user id or shorten it |

## Phase 3: guardrails in Sentry (settings, no code)

1. **Spike protection / per-project rate limits.** Settings → Projects → Client Keys
   (DSN) → rate limit, for alert-worker and streamwizard-bot at minimum, so one
   broken loop can't use up the whole org's error or log quota.
2. **Usage check.** Settings → Stats & Usage → Logs, once before and once a week
   after Phase 1 ships, to confirm we're far under 5 GB.
3. **Hide the stale `prod` environment** in web-admin's project settings, and make
   `getSentryOptions` map `ALERT_ENV=prod` to `production` so it can't come back.

## Verification

- Before shipping: record per-project line counts for the last 7 days (Explore → Logs,
  group by project + severity).
- After deploy: the same query 24h later. Expected: streamwizard-bot and alert-worker
  near zero info lines; total Sentry log volume down >95%; warn/error counts
  unchanged except the removed noise.
- Test: a unit test for `beforeSendLog` (drops the server-action message, redacts a
  token) and for the shared rate limiter.
- Local: `console.log` still prints in `bun dev` for each backend app.

## Order

Phase 0 → Phase 1 + 2 together → Phase 3 settings. Phase 0 is the only part that
changes runtime behaviour beyond logging (the conduit recovery), so it goes first and
gets its own review.
