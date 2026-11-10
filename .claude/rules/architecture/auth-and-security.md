---
paths:
  - "apps/*/src/proxy.ts"
  - "apps/web-streamwizard/src/lib/auth.ts"
  - "apps/web-streamwizard/src/lib/obs/node-token.ts"
  - "apps/web-streamwizard/src/lib/cms/cms-revalidate.ts"
  - "apps/web-streamwizard/src/actions/obs/*.ts"
  - "apps/web-admin/src/lib/auth/admin-session.ts"
  - "apps/web-admin/src/lib/auth/assert-admin.ts"
  - "apps/web-admin/src/lib/auth/admin-context.ts"
  - "apps/web-admin/src/actions/nodes/*.ts"
  - "apps/web-admin/src/lib/internal-auth-header.ts"
  - "apps/web-overlay/src/lib/widget-api.ts"
  - "apps/web-overlay/src/lib/overlay-item-auth.ts"
  - "apps/rest-api/src/middleware/**"
  - "apps/rest-api/src/routes/**"
  - "apps/rest-api/src/lib/secret-compare.ts"
  - "apps/rest-api/src/modules/obs-nodes/**"
  - "apps/rest-api/src/modules/ingest-nodes/**"
  - "apps/ws-server/src/**"
  - "apps/discord-bot/src/http/**"
  - "packages/service-token/**"
  - "packages/node-token/**"
  - "packages/supabase/src/auth/**"
  - "packages/supabase/src/crypto.ts"
---

# Auth and security

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md); this page has the detail.

Every caller proves who it is with its own credential, scoped to what it may do. A user's Supabase session never leaves our own apps: nodes and services get their own short-lived tokens or per-node keys instead.

## Who proves what

| Caller → callee | Credential | Checked in |
|-----------------|------------|-----------|
| Streamer browser → web-streamwizard | Supabase session cookie (Twitch sign-in) | `src/proxy.ts` + `(protected)` layout; every server action starts with `tryAuthContext()` (or `getAuthContext()`) from `lib/auth.ts` and takes user and broadcaster ids only from it, never from its arguments; RLS in Postgres is the second line, not the only one |
| Admin browser → web-admin | Supabase session + verified TOTP (`aal2`) + admin role | `src/proxy.ts` (deny by default), `requireAdminSession()` in layouts, the `lib/auth/admin-context.ts` helpers (built on `assertAdmin()`, `lib/auth/assert-admin.ts`) in every action, `getAdminSession()` in every route handler, SQL `is_strong_admin()` |
| web-streamwizard server action → rest-api `/api/clips/*` | the signed-in user's Supabase JWT, forwarded by the server | `supabaseMiddleware()` / `supabaseAuth()` |
| OBS browser source → ws-server (`subscriber`) | the scene's `subscriber_token` (resettable), or a dashboard JWT | `modules/connections/upgrade.ts`; a key reset closes live sockets (`modules/revoke`) |
| OBS browser source → web-overlay `/api/*` | the scene's `subscriber_token` in `Authorization: Bearer` | `lib/widget-api.ts` + `getOverlaySceneBySubscriberToken` |
| Our services → ws-server (`bot`, `consumer`, `/internal/*`) | 60-second Ed25519 service token, one scope per token, audience `ws-server` | `@repo/service-token` (`createServiceAuth`); ws-server holds only public keys (`WS_SERVICE_JWKS`) and checks `SERVICE_POLICY` |
| Node install script → rest-api `/api/{obs,ingest}-nodes/claim` | one-time claim token (32 random bytes, only its SHA-256 stored, expires) | `modules/*/claim.ts`, atomic `consume*ClaimToken` |
| Ingest / OBS node → rest-api | per-node API key from the one-time claim; only its SHA-256 hash is stored | `middleware/node-key-auth.ts` (shared), wrapped by `middleware/ingest-node-auth.ts` and `middleware/obs-node-auth.ts` |
| Ingest node → ws-server (`ingest-node`) | 60-second service token rest-api signs before each dial, node id in the token | ws-server upgrade |
| Admin browser → ws-server (`monitor`) | 60-second service token (scope `monitor`) that web-admin signs in `mintMonitorTokenAction` after `requireAdmin()`, minted before each dial; sent as `?token=` because browsers can't set WebSocket headers | `modules/connections/upgrade.ts`, `SERVICE_POLICY` (web-admin only) |
| Browser or web-admin → OBS node | 60-second node token: one node, one scope, one instance | minted by a server action after ownership + plan checks; the node verifies with the public JWKS from `GET /api/obs-nodes/me` |
| obs-auto-switcher → OBS node | per-node `obs_command` key, stored encrypted | the node's `/obs` route |
| Twitch → rest-api webhook | HMAC signature, timestamp freshness, message-id dedupe | `middleware/twitch-eventsub.ts` |
| Proxmox VE / PBS → rest-api `/webhooks/proxmox` | `x-proxmox-webhook-token` header = `BACKUP_WEBHOOK_SECRET` | `routes/proxmox-webhook.ts`, `secretsMatch` |
| web-admin → rest-api `/internal/*` | 60-second service token, scope `backups`, audience `rest-api` (the old `REST_API_INTERNAL_SECRET` is still accepted until SW-494's follow-up removes it) | `middleware/internal-auth.ts`, public keys in `REST_API_SERVICE_JWKS` |
| web-admin, rest-api cms-scheduler → web-streamwizard `/api/revalidate` | bearer `CMS_REVALIDATE_SECRET` | `lib/cms/cms-revalidate.ts` |
| web-admin → discord-bot HTTP | 60-second service token, scope `discord-guilds`, audience `discord-bot` (the old `DISCORD_BOT_INTERNAL_SECRET` is still accepted until SW-494's follow-up removes it) | `src/http/middleware/service-auth.ts`, public keys in `DISCORD_BOT_SERVICE_JWKS` |

Every web-streamwizard server action except `login()` / `logout()` starts with `tryAuthContext()`.

**New calls between our services use service tokens, not a shared secret.** Add the scope to `SERVICE_SCOPES`, the service that handles it to `SCOPE_AUDIENCE` (the token's audience comes from there, so a token for one service is refused by every other), grant it to the caller in `SERVICE_POLICY`, and check it on the receiving side with `createServiceAuth({ audience, jwks })`. The receiver holds only public keys; without its JWKS the routes answer 404. Shared secrets are left only where the caller isn't one of our services (Proxmox webhooks) and for `CMS_REVALIDATE_SECRET`.

## Ingest nodes

1. The install script claims the node (`POST /api/ingest-nodes/claim`) with a one-time claim token and gets the node's API key.
2. With that key the node opens and ends sessions and posts stats on rest-api. rest-api registers each session with ws-server (`/internal/ingest-sessions`, scope `ingest-sessions`).
3. Before every WebSocket dial the node asks `POST /api/ingest-nodes/me/ws-token` for a fresh token and connects with `role=ingest-node`. It only ever sends session ids; ws-server looks up the user and stream key itself, so a node can't send stats into someone else's room.
4. Deleting a node in web-admin closes its socket (`/internal/ingest-nodes/:id/revoke`), and rest-api stops signing tokens for it.

## Cloud OBS nodes

1. The install script claims the node (`POST /api/obs-nodes/claim`) and gets the node's API key.
2. Nodes never hold `TOKEN_ENCRYPTION_KEY`. A node fetches the secrets of the instances it hosts from rest-api (`/api/obs-nodes/instances/:id/secrets`) and gets temporary storage credentials (`/storage-credentials`, shared read-only and per instance). A node can only reach its own instances.
3. The browser talks to the node directly (start/stop, files, WebSocket tickets) with node tokens, never with the Supabase session. Mint one per request with `nodeToken()` and never cache it.
4. Creating an instance needs the `instances:create` node token the web app signed for that launch; the node forwards it to rest-api, which accepts each token once. A node can't create an instance (and so reach a stream key) for a user who didn't ask for one.
5. Instance lifecycle and scene events go node → rest-api → ws-server broadcast.

## Secrets and data at rest

- **Twitch tokens and node keys are encrypted** with AES-256-GCM (`@repo/supabase/crypto`, `TOKEN_ENCRYPTION_KEY`). Only server processes that must decrypt hold the key; nodes and browsers never do.
- **API keys and claim tokens are stored as hashes only.** The plaintext is shown once, at claim time.
- **Secrets live in Doppler**, per app and environment. Never in the repo, logs, Sentry events or error messages. Routes that return secrets never log their response body.
- **Credentials travel in headers** (`Authorization: Bearer`), never in a URL, so they stay out of proxy logs, `Referer` and Sentry. Two exceptions: WebSocket upgrades from a browser (no headers possible) send `?token=` and should use a short-lived token there, and CMS preview links carry their token in the path, which `@repo/sentry` redacts.
- **Compare secrets in constant time:** hash both sides with SHA-256, then `timingSafeEqual`, so neither the value nor its length leaks. Never `===`. rest-api's `secretsMatch` (`lib/secret-compare.ts`) is the reference; rest-api, web-streamwizard and discord-bot each keep a copy today (ws-server holds no shared secrets). Don't write another one: move the helper into a shared package when you need it elsewhere.
- **The ws-server monitor feed is sanitized**: names masked, messages and GPS redacted, token fields dropped.

## Rules for new code

- **A new ws-server action** gets a new scope in `SERVICE_SCOPES` and is granted per service in `SERVICE_POLICY`. Every service signs with its own key; never share one.
- **A browser that needs a ws-server credential gets a service token from its app's server**, minted per dial after the app's own auth check (like `monitor`). Signing keys and shared secrets never go in a `NEXT_PUBLIC_*` variable or a client bundle.
- **A new OBS node action** gets a new node-token scope, minted in a server action only after checking the user owns the instance.
- **A new endpoint for nodes, services or third parties goes in rest-api** behind the matching middleware, never in a Next app.
- **Prefer service tokens over new shared secrets.** The remaining bearer-secret routes (rest-api `/internal/*`, discord-bot HTTP, web-streamwizard `/api/revalidate`, the Proxmox webhook) are server-to-server only; moving them to service tokens is SW-494.
- **Rate limits and lockouts:** rest-api blocks a client IP for an hour after 10 401s within 15 minutes (`middleware/security/brute-force.ts`, on `@repo/ttl-cache`). Only a successful authenticated request clears the count. It skips webhooks, `/internal/*` and the node routes (`/api/obs-nodes`, `/api/ingest-nodes`), which rely on their credential's strength. rest-api has no per-route request rate limiter. ws-server rate-limits `subscriber` upgrades (`middleware/rate-limit.ts`). A new public endpoint gets a `MissLimiter` or a `TtlCache` counter from `@repo/ttl-cache`, and answers bad credentials with a 401 so the lockout counts them.
- **This repo is public.** Commits, PRs and docs describe how auth works, never an unfixed weakness, a bypass or an infrastructure address.

The full walkthrough, with the open-risk list, is in Confluence (Development space). `docs/auth-overview.md` is a local, git-ignored working copy; never commit it while it lists unfixed risks.
