---
paths:
  - "apps/*/src/**"
  - "packages/*/src/**"
---

# Errors and logging

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md).

## Reporting errors

- **Unexpected errors go to Sentry** through `@repo/sentry`: `reportError(err, "<area>.<action>", context)` for errors you handle and recover from, `reportFatal` for the process-level handlers.
- **Never swallow an error silently.** Two exceptions, both for expected outcomes only: a lookup where "not found" is a normal answer (`guild.members.fetch(id).catch(() => null)`, then handle `null`), and best-effort cleanup or a reply to an interaction that may have expired. Anything that writes data, deletes data or is the main job of the code path reports with `reportError` instead.
- **The tag says where it happened**, as `"<area>.<action>"` in kebab-case (`"config-store.reconcile"`, `"ws.ingest-stats"`). Don't repeat the app name: `getSentryOptions` already tags every event with its service. The tag is used for grouping, so it never contains an id; ids go in the context object (user id, node id, instance id), never secrets, tokens or full payloads. **Current state:** most existing tags use `"<app> <area>: <action>"` or a path (`"actions/user/settings"`); rename them when you touch the file.
- **Expected outcomes are not errors.** A user without a Twitch link, a 404 from Helix, a rate-limited request: handle them, maybe count them in metrics, but don't report them. Every report should be something a person might need to act on.
- **Anything that can fail on every tick, message or retry throttles its own reports:** report the first failure, then at most one an hour while it continues. `@repo/sentry` drops the same error after 20 a day and all errors after 200 a day per process. That is a safety net, not a budget to spend.
- **Noise filters and redaction live in `@repo/sentry` only** (`IGNORED_LOG_PATTERNS`, `PII_PATTERNS`). Add a pattern there with a comment saying why, never a filter in an app.
- **Long-running services** register `uncaughtException` / `unhandledRejection` handlers on the first lines of `index.ts`, and every deliberate exit (including the SIGTERM/SIGINT shutdown) awaits `flushSentry()` first. The full pattern is in [backend-services.md](backend-services.md).
- **One bad message must not kill a server.** WebSocket and queue handlers wrap per-message work in `try/catch` and report, instead of letting it reach the process handler.

## Logging

- **Log state changes, not activity.** "connected", "monitor created", "shutting down" are fine; one line per request, message or tick is not.
- **Levels:** `console.debug` for step-by-step tracing and `console.log` for routine lifecycle (both stay in container output only); `console.warn` for degraded but working; errors go through `reportError` (it writes the `console.error` line for you). Only `warn` and `error` are forwarded to Sentry Logs, which is metered, so a warn per tick or per message is a quota bug.
- **Prefix every line with its area** in brackets: `[stats-feed] connected`.
- **Never log** tokens, keys, passwords, cookies, `Authorization` headers, full request or response bodies of secret routes, or personal data beyond ids.
- **Never log or report a raw HTTP client error** (an AxiosError, a Helix error, a fetch `Response`): its config carries headers, params and bodies with tokens and secrets. Log axios and Helix errors with `describeError` and report them with `reportError`, both from `@repo/sentry` (`@repo/sentry/safe-error`), never by passing the raw error object to `console.*`.

## What callers see

- **Server actions return `{ data, error }` or `{ success, error }`** and never throw to the client. `error` is a short sentence the user can act on, written per `docs/tone_of_voice.md`.
- **Messages meant for the user are a typed error.** Throw a small class (`CmsError`, `DashboardError`, `BuiltMessageError`) whose message is written for the user; the action's catch returns that message, and anything else goes through a `toActionError(error, tag, fallback)` helper that calls `reportError` and returns the fixed fallback. Expected outcomes from packages are typed too (`DiscordNotFoundError`, `DiscordRateLimitError`), so callers handle them without reporting.
- **Never send internals** to a browser, node or third party: no stack traces, SQL or Supabase error messages, file paths or upstream response bodies. Log the detail, return a generic message ("Couldn't start your OBS. Try again in a minute.").
- **HTTP APIs** use the right status code (400 bad input, 401 no or bad credentials, 403 not allowed, 404 not found or not yours, 409 conflict, 429 rate limited) with a small JSON error. In rest-api, `app.onError(createApiErrorHandler())` (`src/middleware/error-handler.ts`, wired in `src/app.ts`) reports unhandled errors and answers with a generic 500 and the request id; an `HTTPException` keeps its own response. Hono catches a route's error before a try/catch middleware around `next()` sees it, so custom handling goes in that handler, never in a middleware.
- **Next.js pages** use `error.tsx` / `not-found.tsx` boundaries; a missing record calls `notFound()` instead of rendering an empty page.
