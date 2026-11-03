---
paths:
  - "apps/*/src/**"
  - "packages/*/src/**"
---

# Errors and logging

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md).

## Reporting errors

- **Unexpected errors go to Sentry** through `@repo/sentry`: `reportError(err, "<area>.<action>", context)` for errors you handle and recover from, `reportFatal` for the process-level handlers. Never swallow an error silently.
- **The tag says where it happened** (`"config-store.reconcile"`, `"ws.ingest_stats"`). The context object carries ids (user id, node id, instance id), never secrets, tokens or full payloads.
- **Expected outcomes are not errors.** A user without a Twitch link, a 404 from Helix, a rate-limited request: handle them, maybe count them in metrics, but don't report them. Every report should be something a person might need to act on.
- **Long-running services** register `uncaughtException` / `unhandledRejection` handlers first thing in `index.ts` and call `flushSentry()` on shutdown, like the existing services.
- **One bad message must not kill a server.** WebSocket and queue handlers wrap per-message work in `try/catch` and report, instead of letting it reach the process handler.

## Logging

- **Log state changes, not activity.** "connected", "monitor created", "shutting down" are fine; one line per request, message or tick is not. The console is forwarded to Sentry logs, and noise there costs quota.
- **Prefix every line with its area** in brackets: `[stats-feed] connected`.
- **Never log** tokens, keys, passwords, cookies, `Authorization` headers, full request or response bodies of secret routes, or personal data beyond ids.
- `console.warn` for degraded but working, `console.error` only next to a `reportError`.

## What callers see

- **Server actions return `{ data, error }` or `{ success, error }`** and never throw to the client. `error` is a short sentence the user can act on, written per `docs/tone_of_voice.md`.
- **Never send internals** to a browser, node or third party: no stack traces, SQL or Supabase error messages, file paths or upstream response bodies. Log the detail, return a generic message ("Couldn't start your OBS. Try again in a minute.").
- **HTTP APIs** use the right status code (400 bad input, 401 no or bad credentials, 403 not allowed, 404 not found or not yours, 409 conflict, 429 rate limited) with a small JSON error. In rest-api, `safeErrorHandler` turns anything unhandled into a generic 500.
- **Next.js pages** use `error.tsx` / `not-found.tsx` boundaries; a missing record calls `notFound()` instead of rendering an empty page.
