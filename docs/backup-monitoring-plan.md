# Backup monitoring (Proxmox VE + PBS) — plan

Status: **built 2026-09-28** on `feat/backup-monitoring` (phases 1–5). Tested locally against a fake Proxmox API; not yet run against the real PBS / PVE hosts. See "Build status" at the end.

## Decisions (2026-09-28)
- rest-api runs on Dokploy. Webhooks go to its public HTTPS URL.
- Token gets store-level `DatastoreAudit` on `nas-backups`.
- Job ids are **discovered through the APIs**, not configured by hand. That brings PVE API polling into v1 (see "PVE poller").
- Prod only. Staging leaves the env vars empty, so the feature is off there.
- Thresholds as proposed below.
- Alerts are normal `packages/alerting` rules: shown in `/alerts`, overridable in `/alerts/rules`, delivered through `/alerts/notifications`. No extra Discord log-channel events in v1.
- TLS: PBS gets a real certificate from `tailscale cert`. No pinning code.
- Poll interval: every **6 h** (`BACKUP_POLL_SECONDS`, default 21600), plus a poll a minute after each webhook and the "Poll now" button. Staleness and "not verified yet" checks scale with the interval (decided 2026-09-29).
- Per-VM webhook parsing: TBD. v1 parses the default text, falls back to job-level status, and gets reworked once real samples exist.

## Context
- Two standalone PVE hosts (`pve1` remote, `pve` LAN) back up to one PBS 4.2.0, datastore `nas-backups`, namespace `streamwizard`.
- Goal: rest-api owns all PBS/PVE contact (poller + webhook receiver). web-admin shows a `/backups` page and only talks to rest-api.
- Read-only. The token can never change or delete backups.

## Where it fits in the codebase
**rest-api** (`apps/rest-api`)
- Hono on Bun, one `index.ts`. Env via zod in `src/lib/env.ts`; optional features are `.optional()` pairs, so the feature is off when the vars are missing.
- Webhooks: `POST /webhooks/twitch/eventsub` uses `rawBodyMiddleware()` plus a verification middleware. The Proxmox receiver copies that shape.
- Pollers: `createX(deps) → {sweep,start,stop}` with an `inFlight` guard, `setTimeout/setInterval(...).unref()`, `reportError()` to Sentry (e.g. `services/twitch-token-validator.ts`). Started at the bottom of `index.ts`.
- No leader election; replicas are set in Dokploy.
- No admin/internal routes yet. `/api/nodes` shows how to mount a route before the `/api/*` CORS + Supabase middleware.
- No custom TLS anywhere yet. PBS pinning is new code.

**web-admin** (`apps/web-admin`)
- Next 16 app router. `(monitor)` group is gated by `requireAdminSession()` (admin role + MFA/passkey).
- Page pattern (`/supabase`, `/eventsub`): server component fetches initial data (never throws), client polls an admin-gated route handler with SWR (`useMetricsPoll`).
- Health UI: `components/charts/health-kit.ts` (`band`, `worstStatus`, `TILE_TONE`), `Check[]` model in `supabase-health.tsx`, pure logic in `lib/*-health.ts` with tests.
- Calls other services with a shared secret (`DISCORD_BOT_INTERNAL_URL` + `DISCORD_BOT_INTERNAL_SECRET`). Backups follow that pattern.
- Nav: add `Backups` to the **Infrastructure** group in `lib/nav-config.ts`.

**Alerting**: rules in `packages/alerting/src/rules/*`, thresholds shared via `@repo/alerting/thresholds`, alert-worker ticks every 15 s and sends to Discord/Telegram. Platform events (`packages/types/src/platform-events.ts`) feed the Discord log channel.

## What the Proxmox docs say (checked, differs from the brief)
1. **Webhooks carry no structured per-guest data.** The vzdump template data (`guest-table`) is not exposed to webhook templates. Webhooks only get `title`, `message` (rendered text), `severity`, `timestamp`, `fields.*`, `secrets.*`. Per-VM results must be parsed from `message` text.
2. **PBS backup tasks do not include the namespace.** `worker_id` is `nas-backups:vm/103`. The code has a `FIXME: include namespace`. So PBS task history can't be filtered to `streamwizard` reliably (homelab could also have `vm/103`).
3. **Verify-new sends no notification.** Only scheduled verify jobs notify. Per-snapshot verify state comes from polling `snapshots`.
4. **Store-level ACL is needed for usage + GC.** `/status` (total/used/avail) and `/gc` need `Datastore.Audit` on `/datastore/nas-backups`, not the namespace path.
5. **Webhooks: 10 s timeout, one attempt, no retry.** Our endpoint must answer fast, and polling must cover missed events.
6. PBS verify notifications use type `verify` (the docs table says `verification`, the code sends `verify`).
7. `job-id` field exists only for scheduled vzdump jobs, not manual "Backup now" runs.

Result: **no PBS task-history API.** We get everything we need without `Sys.Audit` on PBS:
- Backup success: newest snapshot per group (poll).
- Backup failure: PVE webhook (real time) + PVE vzdump task list (catches lost webhooks) + snapshot age (silence).
- Verify: `verification.state` per snapshot + `GET /admin/verify` last-run-state.
- Prune / GC: `GET /admin/prune` and `GET /admin/datastore/nas-backups/gc` last-run-state.

## Architecture

```
pve1 ──webhook (vzdump)──┐
pve  ──webhook (vzdump)──┼──► rest-api POST /webhooks/proxmox ──► backup_events (Supabase)
PBS  ──webhook (gc/verify/prune)┘                                        │
                                                                         ▼
PBS API ─┐
pve1 API ─┼─◄─poll every 6 h ─── rest-api backup poller ──► backup_poll_state (Supabase)
pve API  ─┘   (over Tailscale)
                                                                         │
                         status = pure function(poll state, events, now) ◄┘
                                                                         │
web-admin /backups ──server-side, shared secret──► rest-api GET /internal/backups
alert-worker ──reads the same tables──► /alerts + Discord / Telegram
```

### Storage (Supabase, `public`, RLS on, admin SELECT policy, service_role writes — same as `alert_state`)
Why Supabase, not memory: survives restarts, works with more than one replica, gives the audit trail, and alert-worker can read it.

`backup_poll_state` (one row per datastore/namespace)
- `id text pk` (e.g. `nas-backups/streamwizard`)
- `polled_at timestamptz`, `last_ok_at timestamptz`, `last_error text`, `consecutive_failures int`
- `data jsonb` — normalised snapshot: datastore usage, groups, snapshots (our namespace only), GC/verify/prune job state
- The poll claim is a conditional update (`where polled_at < now() - interval`), so only one replica polls per interval.

`backup_events` (audit trail, append-only)
- `id uuid pk`, `source text` (`pve1`/`pve`/`pbs`), `event_type text` (`vzdump`/`gc`/`verify`/`prune`), `job_id text`, `severity text`
- `occurred_at timestamptz` (from payload `timestamp`), `received_at timestamptz`
- `title text`, `message text`, `fields jsonb`
- `guests jsonb` — parsed per-VM rows `[{vmid, name, status, duration_s, size_bytes}]`, or `null` if parsing failed
- `dedupe_key text unique` = sha256 of `source|event_type|job_id|occurred_at|title`
- Retention: delete after 180 days (question below).

Optional later: write `pbs_*` points to Influx for size/age sparklines. Not needed for v1.

### Poller (`apps/rest-api/src/services/backup-poller.ts`)
- Every `BACKUP_POLL_SECONDS` (default 300). First run 30 s after boot.
- Calls in parallel (all GET, all read-only):
  - `/admin/datastore/nas-backups/groups?ns=streamwizard`
  - `/admin/datastore/nas-backups/snapshots?ns=streamwizard`
  - `/admin/datastore/nas-backups/status`
  - `/admin/datastore/nas-backups/gc`
  - `/admin/verify?store=nas-backups` and `/admin/prune?store=nas-backups` — keep jobs whose `ns` is empty (whole store, covers us) or `streamwizard`. These are the discovered PBS job ids.
- `ns=streamwizard` is **always** set from config, never from a request. Nothing from other namespaces is stored or returned.
- Each source succeeds or fails on its own. A failed call keeps the last good value and marks it stale.
- VM list comes from PBS groups. A VM that appears in a webhook but has no group yet is shown as "no backups yet".
- Client: `apps/rest-api/src/lib/pbs-client.ts`, normal TLS against the Tailscale cert, 10 s timeout, `Authorization: PBSAPIToken=<id>:<secret>`.

### PVE poller (same service, same interval)
Needed to find the job ids, and it also improves silence detection.
- Per host: `GET /storage` finds the PBS storage entries with `datastore=nas-backups` and `namespace=streamwizard`.
- `GET /cluster/backup` finds the jobs whose `storage` is one of those entries. This gives our job ids, schedule, `enabled` and VM selection (vmid list / all / pool / exclude).
- `GET /nodes/<node>/tasks?typefilter=vzdump&since=<48h>&errors=1` finds failed vzdump runs, even when the webhook was lost.
- Discovered job ids are stored in `backup_poll_state.data` and used as the webhook allowlist.
- New checks this enables: job disabled, host unreachable, and "scheduled run time passed, no new snapshot" (uses the job schedule instead of only a fixed 26 h).
- Client: `apps/rest-api/src/lib/pve-client.ts`, `Authorization: PVEAPIToken=<id>=<secret>`.
- If a PVE host is unreachable, the PBS side still works. Only that host's checks go `unknown`.

### Webhook receiver (`POST /webhooks/proxmox`)
Order of checks:
1. Body limit 32 KB, `Content-Type: application/json`.
2. Header `X-Proxmox-Webhook-Token` compared in constant time with `BACKUP_WEBHOOK_SECRET`. Wrong or missing → `401`.
3. zod-validate the payload (shape below). Invalid → `400`.
4. Allowlist:
   - `vzdump`: `fields.job-id` is one of the discovered PVE job ids for that host. Manual runs (no job-id) are ignored.
   - `verify` / `prune`: `fields.datastore = nas-backups` and `fields.job-id` is one of the discovered PBS job ids.
   - If discovery has never succeeded yet, events are stored as `pending_match` and matched at the next poll, so nothing is lost at first deploy.
   - `gc`: `fields.datastore = nas-backups`.
   - Anything else → `202 {ignored:true}`, counted in a log line, **not stored**.
5. Parse `guests` from `message` (vzdump only). Parser is tolerant; failure keeps the event with `guests: null` and job-level severity.
6. Insert with `on conflict (dedupe_key) do nothing` → `204`. Duplicate → also `204`.
7. After insert: emit platform event (for the Discord log channel) and trigger a poll soon (debounced, 60 s) so the new snapshot shows up quickly.

No heavy work before the response. Target < 200 ms (Proxmox gives up at 10 s).

**Idempotency / order**
- Duplicates: unique `dedupe_key`.
- Out of order: state is always computed by `occurred_at`, never by arrival order. An older event arriving late never overrides a newer one.
- Clock skew: we store both times. We use `occurred_at` for ordering and `received_at` for "last heard from host".

**Webhook payload** (what we tell Proxmox to send)
```json
{
  "source": "pve1",
  "title": "vzdump backup status (pve1): backup successful",
  "message": "<rendered text incl. the guest table>",
  "severity": "info",
  "timestamp": 1790000000,
  "fields": { "type": "vzdump", "hostname": "pve1", "job-id": "backup-abc123" }
}
```

### Combining webhook + poll into one status per VM
Pure function `computeBackupStatus(pollState, events, now, thresholds)` in `packages/types` or a small shared module, with unit tests. It runs in rest-api (for the API) and alert-worker (for alerts).

Per VM:
- `lastSuccessAt` = newest snapshot `backup-time` from PBS (source of truth).
- `lastEvent` = newest vzdump event with this VMID in `guests` (by `occurred_at`).
- If `lastEvent` failed **and** it is newer than `lastSuccessAt` → the last run failed.
- If `lastEvent` succeeded but no newer snapshot exists after 1 poll cycle → warn ("webhook says OK, PBS has no snapshot").
- Silence: age of `lastSuccessAt` decides, with or without webhooks.
- Poll stale (PBS unreachable) → VM status becomes `unknown`, never `ok`. Last known values are still shown, greyed out.

## Health rules (confirmed)

Per VM:

| Status | Rule |
|---|---|
| error | Newest snapshot older than **50 h** (two missed daily runs) |
| error | Latest vzdump event for this VM failed and no newer snapshot exists |
| error | Newest snapshot `verification.state = failed` |
| error | Any snapshot of this VM failed re-verify in the last monthly run |
| warning | Newest snapshot older than **26 h** |
| warning | Newest snapshot not verified **6 h** after backup |
| warning | Snapshot count below **3** (prune keeps last 3 + dailies, so fewer means missed runs) |
| warning | Webhook said success but no matching snapshot after 1 poll |
| error | VM is in a discovered job, but the job is disabled |
| unknown | No successful poll in **15 min**, or two poll intervals + 10 min when polling less often |
| ok | None of the above |

Overall / PBS:

| Status | Rule |
|---|---|
| error | Datastore used ≥ **90 %** |
| warning | Datastore used ≥ **80 %** |
| error | Last GC failed, or last GC older than **48 h** |
| error | Prune job last run failed, or older than **48 h** |
| error | `monthly-reverify` last run failed |
| warning | `monthly-reverify` last run older than **33 days** |
| warning | No webhook from a host for **26 h** while its VMs exist (host or webhook path silent) |
| error | PBS poll failing for **15 min** (scaled to two poll intervals + 10 min) |
| error | A PVE host API unreachable for **15 min** (scaled like above; only that host's VMs go `unknown`) |
| error | A vzdump task failed in the last 48 h (from the PVE task list, even without a webhook) |

Overall status = worst of all checks (same as `/supabase`).

## REST API design (rest-api)
All mounted before the `/api/*` middleware. Internal routes use `Authorization: Bearer ${REST_API_INTERNAL_SECRET}`, checked in constant time. web-admin calls them server-side only.

| Method | Path | Purpose |
|---|---|---|
| POST | `/webhooks/proxmox` | Webhook receiver (header token) |
| GET | `/internal/backups` | Overview |
| GET | `/internal/backups/vms/:vmid` | One VM: snapshots + events |
| GET | `/internal/backups/events?before=&limit=` | Event history, cursor paging |
| POST | `/internal/backups/refresh` | Poll now (max once per 60 s). Still read-only towards PBS |

`GET /internal/backups`
```ts
type BackupStatus = "ok" | "warning" | "error" | "unknown";

type BackupOverview = {
  status: BackupStatus;
  checks: { id: string; label: string; status: BackupStatus; hint: string }[];
  poll: { polledAt: string | null; lastOkAt: string | null; error: string | null; stale: boolean };
  datastore: { name: string; namespace: string; totalBytes: number; usedBytes: number; availBytes: number; usedPct: number } | null;
  jobs: {
    gc:     { lastRunAt: string | null; state: "ok" | "error" | "unknown"; nextRunAt: string | null; removedBytes?: number };
    prune:  { id: string; lastRunAt: string | null; state: string; nextRunAt: string | null } | null;
    verify: { id: string; lastRunAt: string | null; state: string; nextRunAt: string | null }[];
  };
  hosts: { name: string; lastEventAt: string | null; status: BackupStatus }[];
  vms: BackupVm[];
};

type BackupVm = {
  vmid: number;
  name: string | null;           // from PBS group/snapshot comment
  host: string | null;           // from the latest webhook that mentioned this VMID
  status: BackupStatus;
  reasons: string[];             // why it is not ok
  lastSuccessAt: string | null;
  ageSeconds: number | null;
  snapshotCount: number;
  lastSizeBytes: number | null;  // logical size of newest snapshot, not deduplicated
  verification: "ok" | "failed" | "pending" | "none";
  lastEvent: { at: string; status: "ok" | "failed"; source: string } | null;
};
```

`GET /internal/backups/vms/:vmid` → `BackupVm` + `snapshots: { time, sizeBytes, verification, protected }[]` + `events: BackupEvent[]` (last 30).

## web-admin UI
- Nav: **Infrastructure → Backups** (`/backups`, lucide `DatabaseBackup`).
- `lib/backups.ts`: server-side fetch to rest-api, never throws, returns `{ data, error }`.
- `app/api/backups/route.ts`: admin-gated (`getAdminSession()`), proxies to rest-api. The client polls it with SWR (60 s default, uses the existing refresh-interval selector).

**Overview `/backups`**
- Health banner (worst check + reason list), same component style as `/supabase`.
- KPI tiles: VMs OK (4/5), newest-oldest backup age, datastore used % with free space, last GC, last prune, monthly re-verify.
- VM table: status dot, name, VMID, host, last backup (relative + exact on hover), age, snapshots, size, verification, last event. Sorted by status (worst first). Row links to detail.
- "PBS unreachable since …" banner when the poll is stale. Values greyed, status `unknown`.
- Recent events list (last 10): source, type, severity, time.

**Detail `/backups/[vmid]`**
- Header: name, VMID, host, status + reasons.
- Snapshot table: time, size, verification badge, protected.
- Size sparkline over snapshots (from snapshot data, no Influx needed).
- Event timeline: webhook events for this VM, with the parsed guest row and a collapsible raw `message`.

Pure status logic lives in the shared module with tests. UI only renders.

## TLS (Tailscale certificate)
- PBS serves a Let's Encrypt cert for `pbs.tail98b586.ts.net` from `tailscale cert`. rest-api uses normal verification. No TLS code, no env vars for certs.
- Install on PBS (as root), then renew with a monthly systemd timer or cron job:
  ```sh
  tailscale cert \
    --cert-file /etc/proxmox-backup/proxy.pem \
    --key-file  /etc/proxmox-backup/proxy.key \
    pbs.tail98b586.ts.net
  chown root:backup /etc/proxmox-backup/proxy.pem /etc/proxmox-backup/proxy.key
  chmod 640 /etc/proxmox-backup/proxy.key
  systemctl reload proxmox-backup-proxy
  ```
- **Warning: this breaks backups unless the PVE storage configs change too.** Both PVE hosts pin the current PBS fingerprint in their storage config. A new cert gives a new fingerprint, and the fingerprint changes again at every renewal (about every 60–90 days). Before the switch, on **both** hosts:
  - Set the storage `server` to `pbs.tail98b586.ts.net` (the cert name must match).
  - Remove `fingerprint` from the storage, so PVE uses normal CA verification.
  - `pve` (LAN) must then reach PBS over Tailscale or resolve that name to 10.10.10.209. See question 2.
  - Run one manual backup per host afterwards to confirm it works.
- Same approach for the PVE hosts' API (port 8006): `tailscale cert` + `pvenode cert set`, so rest-api can verify them too. Nothing pins PVE certs, so there is no backup risk there.

## Setup you need to do

### 1. PBS: read-only user + token
Run as root on PBS:
```sh
proxmox-backup-manager user create sw-monitor@pbs --comment "StreamWizard backup monitoring (read-only)"
proxmox-backup-manager user generate-token sw-monitor@pbs rest-api   # secret is shown once
# token rights = intersection with the user's rights, so both need the ACL
proxmox-backup-manager acl update /datastore/nas-backups DatastoreAudit --auth-id sw-monitor@pbs
proxmox-backup-manager acl update /datastore/nas-backups DatastoreAudit --auth-id 'sw-monitor@pbs!rest-api'
```
- `DatastoreAudit` = `Datastore.Audit` only. It lists metadata. It **cannot** read backup contents, restore, verify, prune, delete or change anything.
- It is store-level because `/status` and `/gc` refuse namespace-scoped ACLs. This means the token can *see* homelab group names. Our code only ever requests `ns=streamwizard`. See question 3.
- **No** `Sys.Audit` on `/system/tasks` — not needed in this design.
- No password on the user, so nobody can log in to the UI with it.

### 2. PVE: read-only token (pve1 and pve, each separately)
Run as root on each host:
```sh
pveum user add sw-monitor@pve --comment "StreamWizard backup monitoring (read-only)"
pveum user token add sw-monitor@pve rest-api --privsep 1   # secret is shown once
pveum acl modify / --roles PVEAuditor --users sw-monitor@pve
pveum acl modify / --roles PVEAuditor --tokens 'sw-monitor@pve!rest-api'
```
- `PVEAuditor` is read-only (`Sys.Audit`, `VM.Audit`, `Datastore.Audit`, ...). It cannot start, stop, back up, restore or change anything.
- It covers `/storage`, `/cluster/backup` and all vzdump tasks on the node.

### 3. PVE: webhook target + matcher (pve1 and pve, each separately)
First, on each streamwizard backup job: **Notification mode = "notification system"** (Datacenter → Backup → job → Notification). The legacy sendmail mode skips webhooks.

The job id is in the GUI (Datacenter → Backup, "ID" column) or `pvesh get /cluster/backup`. The matcher needs it once. rest-api discovers it on its own for the allowlist.

Body file `body.json` (change `source` per host):
```
{"source":"pve1","title":"{{ escape title }}","message":"{{ escape message }}","severity":"{{ severity }}","timestamp":{{ timestamp }},"fields":{{ json fields }}}
```
Commands (on pve1; on pve use `"source":"pve"` and its own job id):
```sh
pvesh create /cluster/notifications/endpoints/webhook \
  --name streamwizard-api \
  --url https://<API_HOST>/webhooks/proxmox \
  --method post \
  --header "name=Content-Type,value=$(printf 'application/json' | base64 -w0)" \
  --header "name=X-Proxmox-Webhook-Token,value=$(printf '{{ secrets.token }}' | base64 -w0)" \
  --secret "name=token,value=$(printf '<BACKUP_WEBHOOK_SECRET>' | base64 -w0)" \
  --body "$(base64 -w0 body.json)" \
  --comment "StreamWizard backup monitoring"

pvesh create /cluster/notifications/matchers \
  --name streamwizard-backups \
  --match-field exact:type=vzdump \
  --match-field exact:job-id=<STREAMWIZARD_JOB_ID> \
  --mode all \
  --target streamwizard-api
```
- No severity filter: we want success and failure.
- The existing default matcher (mail) stays as it is.
- GUI path: Datacenter → Notifications → Add → Webhook, then Add → Matcher.

### 4. PBS: webhook target + matcher
Check the datastore uses the notification system (Datastore → Options → Notification mode). Then:
```sh
proxmox-backup-manager notification endpoint webhook create streamwizard-api \
  --url https://<API_HOST>/webhooks/proxmox \
  --method post \
  --header "name=Content-Type,value=$(printf 'application/json' | base64 -w0)" \
  --header "name=X-Proxmox-Webhook-Token,value=$(printf '{{ secrets.token }}' | base64 -w0)" \
  --secret "name=token,value=$(printf '<BACKUP_WEBHOOK_SECRET>' | base64 -w0)" \
  --body "$(base64 -w0 body-pbs.json)" \
  --comment "StreamWizard backup monitoring"

proxmox-backup-manager notification matcher create streamwizard-pbs-jobs \
  --match-field exact:datastore=nas-backups \
  --match-field exact:type=gc,verify,prune \
  --mode all \
  --target streamwizard-api
```
- `body-pbs.json` = same template with `"source":"pbs"`.
- Matchers can't filter by namespace, and GC has no job id. The matcher sends all nas-backups GC/verify/prune events. rest-api drops job ids it did not discover for our namespace, without storing them.
- Secrets end up in `/etc/pve/priv/notifications.cfg` (PVE) and `/etc/proxmox-backup/notifications-priv.cfg` (PBS), not in the readable config.
- Test: GUI → Notifications → select target → **Test**. Test events have no job id, so the receiver answers `202`, stores nothing, and logs "test received from pve1". Check the rest-api log.

### 5. Env vars
rest-api (Doppler, **prod only**; missing vars = feature off, so staging stays off):

| Var | Example | Secret |
|---|---|---|
| `PBS_URL` | `https://pbs.tail98b586.ts.net:8007` | no |
| `PBS_DATASTORE` | `nas-backups` | no |
| `PBS_NAMESPACE` | `streamwizard` | no |
| `PBS_TOKEN_ID` | `sw-monitor@pbs!rest-api` | no |
| `PBS_TOKEN_SECRET` | — | **yes** |
| `PVE_HOSTS` | JSON: `[{"name":"pve1","url":"https://pve1.<tailnet>.ts.net:8006","tokenId":"sw-monitor@pve!rest-api","tokenSecret":"…"}, …]` | **yes** |
| `BACKUP_POLL_SECONDS` | `300` | no |
| `BACKUP_WEBHOOK_SECRET` | 32+ random bytes | **yes** |
| `REST_API_INTERNAL_SECRET` | 32+ random bytes | **yes** |

web-admin: `REST_API_INTERNAL_SECRET` (server-only, in the `env.ts` `server` block). `STREAMWIZARD_API_URL` already exists.

Thresholds are constants in `@repo/alerting/thresholds` (like `supabase.deadlocks`), overridable per rule in `/alerts/rules`.

## Alerting
Same as every other alert: rules in `packages/alerting`, group `backup`, listed in `/alerts`, tunable in `/alerts/rules`, sent through `/alerts/notifications`.
- New file `packages/alerting/src/rules/backup.ts`, `customRule`s that read `backup_poll_state` + `backup_events` and call the shared status function.
- Rules:
  - `backup.vm_stale` — warn 26 h / crit 50 h, one alert per VM
  - `backup.vm_failed` — last run failed, per VM
  - `backup.verify_failed` — per VM
  - `backup.job_disabled` — a discovered PVE job is disabled
  - `backup.datastore_usage` — warn 80 % / crit 90 %
  - `backup.pbs_jobs` — GC / prune / re-verify failed or overdue
  - `backup.source_unreachable` — PBS or a PVE host not polled for 15 min (scaled to the poll interval)
- Resolves by itself once healthy, like the other rules.

Later, optional: Influx `pbs_*` points for long-range charts, Discord log-channel events, weekly summary.

## Phases (one commit each, one PR against `staging`)
1. Migration (`backup_poll_state`, `backup_events`) + `pbs-client.ts` + `pve-client.ts` + poller with job discovery + shared status function + tests.
2. Webhook receiver + guest-table parser (default text, job-level fallback) + dedupe + tests.
3. Internal GET endpoints + internal-secret middleware.
4. web-admin `/backups` + `/backups/[vmid]` + nav.
5. Alert rules.
6. Docs: setup runbook in Confluence (steps above, including the TLS switch).

## Answered (2026-09-28)
1. Dokploy host is on Tailscale. rest-api reaches PBS and both PVE hosts over the tailnet. Replica count unknown; the poll claim makes it safe either way.
2. `pve` is on Tailscale, so it can reach PBS by `pbs.tail98b586.ts.net` after the cert switch.
3. pve1 and pve also get `tailscale cert` for port 8006.
4. Event retention: 180 days.
5. VMIDs stay unique across hosts.

## Build status (2026-09-28)

**Code**
- `packages/backups` (`@repo/backups`): shared types, thresholds, response normalisers (namespace filtering), `computeBackupOverview()`, webhook classification + vzdump text parser. 29 tests.
- `supabase/migrations/20260928140000_backup_monitoring.sql`: `backup_poll_state`, `backup_events`, RLS, 180-day purge via pg_cron. `packages/supabase/src/queries/backups.ts` + hand-edited types.
- rest-api: `lib/proxmox-client.ts` (GET only), `lib/backup-sources.ts` (PBS + PVE fetch, job discovery, failed task logs), `services/backup-poller.ts` (claim, per-source health, reconcile unmatched events), `routes/proxmox-webhook.ts`, `routes/backups-internal.ts`, `middleware/internal-auth.ts`. Mounted at `/webhooks/proxmox` and `/internal/backups`.
- web-admin: `/backups` + `/backups/[vmid]`, `/api/backups` proxies (admin-gated), "Poll now" server action, nav item under Infrastructure.
- alerting: `rules/backup.ts`, group "Backups", 7 rules, prod only by default.

**Differences from the plan above**
- VMs also carry structured `issues` (code + status + message) next to `reasons`, so alert rules don't parse text.
- Webhook events that arrive before job discovery are stored `matched = false` and settled (confirmed or deleted) after the next poll.
- Failed vzdump runs from the PVE task list are attributed per VM by reading the task log (`ERROR: Backup of VM <id> failed`). Tasks that touch none of our VMs are dropped.
- The "Poll now" button is rate-limited to once a minute by rest-api.

**Verified locally**
- Unit tests: backups 29, alerting 45, rest-api 108. Typecheck clean for all touched apps. Lint clean for the new web-admin files.
- End to end with a fake PBS/PVE API: webhook auth (401), unmatched → matched/dropped after discovery, homelab job ignored (202, not stored), duplicate delivery no-op, refresh rate limit (429), overview + VM detail rendered in the browser with an aal2 admin session. Found and fixed a jsonb `contains` bug in the VM event query.

**Not verified**
- Real PBS 4.2 / PVE responses (field names are from the API schema, not a live call).
- Real vzdump notification text (parser matches the default template; waiting on samples).
- alert-worker running the new rules against real data.

## Deploy checklist
1. Apply the migration to prod through the normal workflow.
2. Proxmox side (see "Setup you need to do"): PBS token, PVE tokens, `tailscale cert` on PBS + PVE (**remove the PBS fingerprint from both PVE storage configs first**), webhook targets + matchers.
3. Doppler prod rest-api: `PBS_URL`, `PBS_NAMESPACE`, `PBS_TOKEN_ID`, `PBS_TOKEN_SECRET`, `PVE_HOSTS`, `BACKUP_WEBHOOK_SECRET`, `REST_API_INTERNAL_SECRET` (`PBS_DATASTORE` defaults to `nas-backups`, `BACKUP_POLL_SECONDS` to 300).
4. Doppler prod web-admin: `REST_API_INTERNAL_SECRET` (same value).
5. Deploy rest-api, then web-admin, then alert-worker (new rules).
6. Check: rest-api log shows `[backup-poller] poll done`, `/backups` shows all 5 VMs, a PVE "Test" notification logs `ignored` in rest-api, and the next 03:00 / 05:30 runs appear as webhook events.
