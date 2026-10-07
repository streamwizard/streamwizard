# web-admin — internal admin dashboard

`apps/web-admin` (port 3003, `dev:admin`, Doppler config `dev_web_admin`) is the internal ops app. Since the admin-page migration it carries **all** product-admin tooling; `apps/web-streamwizard` has no admin routes left.

## Access model

- Sign-in: Twitch OAuth via Supabase (own cookie/domain — separate session from the main app), **or** a passkey (no Twitch redirect).
- Gate: `src/lib/admin-session.ts` (`getAdminSession()` / `requireAdminSession()`) is the single decision point. It requires a `user_roles` row with `role = 'admin'` (service-role lookup) **and** a strong session (see "Second factor" below). Non-admins land on `/no-access`; admins with a weak session land on `/auth/verify` or `/auth/setup`.
- `src/app/(monitor)/layout.tsx` and `src/app/vnc/layout.tsx` (bare full-screen popup outside the group) both call `requireAdminSession()`.
- Every server action re-checks via `src/lib/assert-admin.ts` (`assertAdmin()`, returns the acting admin's user id) — actions are their own POST endpoints, the layout guard doesn't cover them. It applies the same rule and throws `Not signed in` / `Not authorized` / `Verification required`.
- Calls to obs-instance-manager's `/admin/instances/*` go through server actions in `src/actions/nodes.ts` for the same reason: that service checks the JWT and the role, not the second factor.
- The old `app_metadata.is_admin` JWT claim is no longer read anywhere; `user_roles` is the single source of admin truth.

## Second factor

Twitch alone is one factor. A session is **strong** when either:

- `aal === 'aal2'`: the admin entered an authenticator-app (TOTP) code after the Twitch redirect, or
- `amr` contains `passkey`: the session was created by `signInWithPasskey()` (GoTrue leaves `aal` at `aal1` for these).

Helpers live in `packages/supabase/src/auth/session-strength.ts`. Every Supabase client factory in `packages/supabase/src/next/*` opts into the passkeys beta (`auth.experimental.passkey`), which is inert for the main app.

| State after sign-in | Where the admin lands |
|---|---|
| Strong session | dashboard |
| Weak, has a TOTP factor and/or a passkey | `/auth/verify` — enter the code, or sign in with the passkey instead |
| Weak, has neither | `/auth/setup` — forced enrolment (at least one; both recommended) |

`/security` (in the user menu at the bottom of the sidebar) manages both methods: add/remove the authenticator, add/rename/remove passkeys. Removing the last remaining method is refused server-side (`src/actions/security.ts`). Supabase allows one verified TOTP factor per user; passkeys are one per device.

Passkeys are registered against a Relying Party ID that is baked into each credential, so it is scoped to the admin host and must never change afterwards:

| Env | `rp_id` | `rp_origins` | TOTP |
|---|---|---|---|
| local (`supabase/config.toml`) | `localhost` | `http://localhost:3003` | enroll + verify on |
| staging (dashboard → Authentication → Passkeys / Multi-Factor) | `admin-staging.streamwizard.org` | `https://admin-staging.streamwizard.org` | enroll + verify on |
| prod (same) | `admin.streamwizard.org` | `https://admin.streamwizard.org` | enroll + verify on |

**Locked out** (lost phone and passkey): in the Supabase dashboard, Authentication → Users → the admin → delete their TOTP factor and/or passkeys. Their next Twitch sign-in lands on `/auth/setup`. There is deliberately no in-app reset.

## Navigation

The sidebar has five groups and 19 items (`src/lib/nav-config.ts`). Sub-pages are tabs at the top of their page, not sidebar items; the tab row is drawn by the `(monitor)` layout from the same config, so adding a tab is one line there.

| Group | Item | Route | Tabs |
|---|---|---|---|
| Home | Dashboard | `/overview` | |
| Support | Tickets | `/discord/tickets` | Queue, Stats, Settings |
| Support | Users | `/users` | |
| Support | Widget review | `/widget-library` | |
| Discord | Announcements | `/discord/announcements` | |
| Discord | Messages | `/discord/messages` | |
| Discord | Event log | `/discord/logs` | Log, Routing (`/discord/logs/settings`) |
| Discord | Server settings | `/discord` | Overview, Welcome, Activity tracking, Go-live, Permissions |
| Monitoring | Alerts | `/alerts` | Active, History, Rules, Notifications |
| Monitoring | API | `/http` | |
| Monitoring | EventSub | `/eventsub` | |
| Monitoring | WebSocket | `/ws` | Metrics, Live feed, Rooms, Topology |
| Monitoring | Database | `/supabase` | Health, App data (`/database`) |
| Infrastructure | OBS nodes | `/obs` | Fleet, Manage (`?tab=manage`) |
| Infrastructure | Ingest servers | `/ingest` | Fleet, Live (`?tab=live`), Manage (`?tab=manage`) |
| Infrastructure | VMs | `/vms` | |
| Infrastructure | Apps | `/apps` | |
| Infrastructure | Traefik | `/traefik` | |
| Infrastructure | Backups | `/backups` | |

- **Counters** next to Tickets (waiting for a reply), Alerts (firing, not silenced) and Widget review (pending) come from `GET /api/nav-counts`, polled every 45 s.
- **Phones** (below 768px) get a bottom bar: Home, Tickets, Alerts, Users, More. "More" opens the full menu as a drawer.
- **Breadcrumb**: group, item and tab come from the nav config; a detail page adds its own level by rendering `<PageCrumb label href />` (`src/lib/crumbs.tsx`). On phones the header shows the last level plus a back arrow.
- **Header controls** (range, refresh, bandwidth) only show on pages whose nav entry lists them under `controls`.
- Route URLs are stable: other apps link in (the Discord bot posts `/discord/tickets/{number}`).
- **Search** (the header button, or Ctrl/Cmd+K) jumps to any page or tab, a ticket by number, or a user by name, email or Twitch name (`src/components/command-palette.tsx`).
- **Dashboard** (`/overview`): what needs attention, one status chip per subsystem (read from the alert engine's state, so it agrees with `/alerts`), live streamers and Cloud OBS load, who is live, shortcuts. Logic in `src/lib/overview.ts`, loading in `src/lib/overview-data.ts`.
- **Desktop-only tools**: the message builder, the WebSocket live feed, the topology graphs and `/vnc` show a notice below 768px and are not mounted there (`src/components/widgets/desktop-only.tsx`).
- **Shared page building blocks** live in `src/components/widgets/`: `PageHeader`, `StatGrid` / `ChartGrid`, `DataList` (a table that becomes cards when narrow), `FilterPanel`, `SaveBar`, `ResponsiveDialog` (a drawer on phones). New pages should start from these. The plan behind the layout is `docs/admin-redesign-plan.md`.

## Pages

| Route | What it does |
|---|---|
| `/overview`, `/http`, `/eventsub`, `/database`, `/supabase`, `/ws/*`, `/alerts/*` | Monitoring (InfluxDB via `@repo/metrics`, alerting config) — pre-existing |
| `/obs` | Two tabs in the page (`?tab=`, no extra routes). **Fleet**: stats, one node list (registry state, health probe and latest metrics merged; a node missing from one source still shows, with blanks), running instances linking to the instance page, history charts. **Manage** (`?tab=manage`): register/edit/delete GPU nodes, claim-token install command |
| `/obs/[nodeId]` | Node detail: hardware card, live metrics stream, instance table (start/stop/remove/VNC), 24h history charts |
| `/obs/[nodeId]/instances/[instanceId]` | Instance detail, tabbed: **Overview** (details incl. RAM limit, CPU quota, shm, config template, storage used/quota + live metrics), **Metrics history** (per-instance InfluxDB series), **Auto Switcher** (edit the owner's switcher config, hold/release scene override) |
| `/ingest` | Three tabs in the page (`?tab=`, no extra routes). **Fleet**: stats, one node list (registry state, health probe, latest host metrics), history charts. **Live** (`?tab=live`): monitor socket status, fleet bandwidth, one streams list (socket and polled metrics joined per stream; loss and retransmit turn amber at 0.5% and red at 2%), node bandwidth. **Manage** (`?tab=manage`): register/edit/delete SRT/SRTLA boxes, claim-token install command |
| `/apps`, `/apps/[env]/[app]`, `/apps/server` | Every app on the Dokploy server, from the Telegraf that runs on it (bucket `webserver`). **List**: the server's load, then one row per app per environment (health, CPU, memory, network, container starts in 24 h, requests, errors, response time); other projects on the server sit folded under "Other", without status colours. An app in `EXPECTED_APPS` (`packages/metrics/src/apps-model.ts`, shared with the alert rules) keeps its row when Telegraf has nothing on it. **App page**: charts plus the containers of the last 24 hours with exit codes, which is where a restart or an OOM kill shows. **Server page**: CPU, memory, swap, disk, network, OOM kills. Only the production Influx org has the bucket, so staging and local say "No server data in this environment" and query nothing. Each read fails on its own: the page names the ones that did not answer and leaves those numbers blank. **Alerts**: the `app.*` and `server.*` rules (`packages/alerting/src/rules/apps.ts`) read the same data from the prod alert-worker: app down, crashed, killed for memory, restart loop, failing healthcheck, memory above its budget; server disk, out of memory, Telegraf silent. A stop counts as a deploy, and never alerts, when a newer container of the app was already running. Staging apps are not watched unless the switch rule `app.watch_staging` is enabled on `/alerts/rules` (staging is not always on); when watched they stay at warn |
| `/traefik` | What Traefik counts about the requests it passes on, from the same Telegraf and bucket as `/apps`. A filter row picks the environment (`?env=`; production by default, "All" for every app on the server). **Right now** (last 5 minutes): share of 5xx answers, share of slow requests (over 1.2 s), share of 4xx answers, request rate, bytes out, open connections, then one row per app with the one in trouble on top. **Over the header's range**: error share, speed bands, requests per protocol, bytes in and out, and a table of which app answered with which error code. **Whole proxy**: open connections and requests per entrypoint, not filtered. Response time is shown as speed bands (under 0.1 s, to 0.3 s, to 1.2 s, to 5 s, over 5 s) because Traefik's histogram has only those four steps: a real p95 needs finer steps in `traefik.yml`. The bands and the slow share count HTTP only; a WebSocket stays open for minutes. Readers: `packages/metrics/src/queries/traefik-queries.ts`; the maths is in `packages/metrics/src/traefik-model.ts`. Charts and the error table refresh from `/api/metrics/traefik`. Same empty states as `/apps`. No alert rules read this data yet |
| `/users`, `/users/[id]` | Everyone with an account: search, filter and sort; a row menu with **Grant access**; a user page with an **Actions** menu (grant access, ban or lift ban, make or remove admin, unlink Discord, resync EventSub, delete account) and tabs for Overview, Plans, EventSub, Tickets, Discord and Activity. Plans (product subscriptions, independent of Stripe) are granted from the row menu or the Actions menu and edited or revoked on the user's **Plans** tab |
| `/subscriptions` | Gone as a page: redirects to `/users?filter=paying` (the "Has a plan" filter), which lists the same people the old grants screen showed with a live plan |
| `/widget-library` | Moderation queue for community widget submissions (sandboxed iframe previews) |
| `/discord/messages`, `/discord/messages/[id]` | Discord messages built visually (banners + embeds, themes, drag to reorder). A server has as many as it likes, each with a name and any text or announcement channel. Draft autosaves to `discord_built_messages`; **Publish** has the bot send or update the message, **Delete** has it remove the message from Discord too. The builder is `MessageBuilder` from `@repo/ui/message-builder`, the data model, limits, presets and starting templates are `@repo/discord-message` |
| `/discord/announcements`, `/discord/announcements/[id]` | One-off announcements for the Discord: a simple form (title, text, colour, image, one link button, a ping: nobody, @everyone, @here or a role) next to a Discord-style preview. Rows live in `discord_announcements` with a status (`draft`, `scheduled`, `posting`, `posted`, `failed`). **Post now** has the bot send it, or edit the message in place (no second ping); **Post later** sets a time and the bot's scheduler (30 s tick, conditional claim) sends it; **Delete** removes it from Discord too. The shape, limits and Discord payload are `@repo/discord-message`'s `announcement` module |
| `/vnc?nodeId&instanceId&name` | noVNC popup onto an instance's OBS desktop (opened from node/instance pages) |

## How it talks to obs-instance-manager

Base URL is always the node's `api_url`, resolved server-side (never from the query string — the URL gets tokens/tickets attached).

REST (Supabase JWT in `Authorization: Bearer`, verified against Supabase JWKS on the node; admin routes additionally check the role via rest-api `GET /api/nodes/users/:userId/is-admin`):

- `GET /health` — node health badges / fleet table / alert probes
- `POST /instances` — create instance (from node detail)
- `POST /admin/instances/:id/start|stop`, `DELETE /admin/instances/:id`
- `POST /admin/ws-ticket`, `POST /admin/instances/:id/ws-ticket` — mint single-use ~30s WS tickets

WebSocket (ticket in query string, minted immediately before every connect):

- `/admin/metrics/stream` — host + per-container metrics (Twitch-EventSub-style envelope)
- `/admin/instances/:id/novnc` — VNC (RFB password comes from the ticket response)
- `/admin/instances/:id/obsws` — obs-websocket proxy; powers the Auto Switcher tab's scene pickers. Password is the instance's OBS WS password, decrypted server-side (`getInstanceObsWsPasswordAdminAction`).

**CORS**: start/stop/remove and ticket mints are browser-side fetches from the web-admin origin. If the manager enforces an Origin allowlist, the admin origin must be on it.

## Auto Switcher editing

Config is **per user** (`obs_auto_switcher_configs`, one row per user), not per instance — the instance page edits its *owner's* row. Admin actions (`src/actions/auto-switcher.ts`) use the service-role client after `assertAdmin()`, then push the row through ws-server `POST /internal/broadcast` so the engine reacts in ~1s. Without `WS_SERVER_URL`/`CONSUMER_SECRET` the push is skipped and the engine's 60s DB reconcile picks the change up instead.

Scene pickers populate only while the instance's OBS is running (obsws session); the form saves fine without it — scenes are stored by uuid, names are display-only.

## Environment (Doppler, per config)

| Var | Required | Purpose |
|---|---|---|
| `INFLUXDB_URL/TOKEN/ORG` | yes | metrics source (org per env, buckets fixed in `packages/metrics/src/buckets.ts`; the `webserver` bucket behind `/apps` exists in the prod org only) |
| `SUPABASE_URL`, `SUPABASE_PUBLIC_KEY`, `SUPABASE_SECRET_KEY` | yes | auth + service-role |
| `STREAMWIZARD_API_URL` | yes | embedded in node install commands (`/obs`, `/ingest`) |
| `TOKEN_ENCRYPTION_KEY` | yes | encrypt/decrypt OBS WS passwords — **must be byte-identical to web-streamwizard's** |
| `WS_SERVER_URL`, `CONSUMER_SECRET` | no | ~1s auto-switcher config pushes (fallback: 60s reconcile) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ASSETS_BUCKET`, `NEXT_PUBLIC_CDN_URL` | no | banner image uploads in the Discord message builder (`discord-banners/` prefix). Without them banners use theme images only. The bot needs the same `NEXT_PUBLIC_CDN_URL`: it only attaches uploads that start with it |
| `SENTRY_DSN`, `ALERT_*`, `DISCORD_BOT_TOKEN`, `TELEGRAM_*`, `MONITOR_SECRET` | no | observability + alert routing |

## Known gaps / roadmap

- **Files tab**: obs-instance-manager only has user-scoped file routes (`/instances/:id/files*`, ownership-checked). Admin file management needs `/admin/instances/:id/files*` mirrors (incl. `/download`, plus the upload body-size exemption in the manager's `index.ts`).
- **No container logs**: a `GET /admin/instances/:id/logs` (or WS tail) on the manager would enable a log viewer.
- **Create-for-user**: `POST /instances` creates under the caller; provisioning an instance *for* a user needs an admin variant with a target `user_id`.
- **Live switcher status card**: the engine publishes status into the user's ws-server room; admin subscription to another user's channel needs a ws-server change.
- **Widget approval cache**: approving a widget no longer revalidates the user-facing `/dashboard/widget-library` cache (cross-app revalidation impossible); entries appear on next request.
