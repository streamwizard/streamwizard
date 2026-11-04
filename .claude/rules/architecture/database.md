---
paths:
  - "packages/supabase/**"
  - "supabase/**"
  - ".github/workflows/*db*.yml"
  - ".github/scripts/check-migrations.sh"
---

# Database (Supabase)

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md); this page has the detail.

Environment variables are in [env.md](env.md).

## Which client

| Where | Client | Import |
|-------|--------|--------|
| Server components, server actions, route handlers acting as the signed-in user (RLS applies) | `createClient()` | `@repo/supabase/next/server` |
| Route handlers that must set cookies on a response | `createRouteHandlerClient(req, res)` | `@repo/supabase/next/server` |
| Client components | `supabase` / `createBrowserClient()` | `@repo/supabase/next/client` |
| Next.js server code with no user session (overlay playback, admin ops) | `supabaseAdmin` (service role) | `@repo/supabase/next/admin` |
| A fresh, non-singleton service-role client in Next server code | `createAdminClient()` | `@repo/supabase/next/admin` |
| Server code outside a request (Next `unstable_cache` callbacks) that should see only anon RLS | `createAnonClient()` | `@repo/supabase/anon` |
| `proxy.ts` session refresh | `updateSession` / `refreshSession` | `@repo/supabase/next/proxy` |
| Bun/Hono routes acting as the signed-in user (cookie or bearer session, RLS applies) | `createRequestClient({ cookieHeader, authorizationHeader, setCookie })` | `@repo/supabase/request-client` |
| Bun services (rest-api, bots, workers, ws-server) | `supabase` (service role) | `@repo/supabase` |

Prefer the user-scoped client. Use a service-role client when there is no user, or, in a signed-in action or page, only **after** `getAuthContext()` / `tryAuthContext()` has authenticated the user and only for tables or RPCs whose RLS deliberately gives users no access (node and ingest keys, asset quota, Discord settings). Every such query takes `user.id` and filters on it (`selectIngestKeyForUser(admin, id, user.id)`), so it can only touch the caller's rows. Never import a service-role client into a `"use client"` file.

Shared packages other than `@repo/supabase` take a `SupabaseClient<Database>` argument. Legacy: twitch-api, twitch-assets and logger still import the root `supabase` singleton.

## Query modules

- One file per domain in `packages/supabase/src/queries/`. A big domain gets a sub-folder whose files are exported one by one as `./queries/<domain>/<name>` (like `cms/`). No barrel files; `queries/obs-nodes.ts` is the legacy exception. Internal helpers (`with-metrics.ts`, `clip-folder-utils.ts`) stay unexported.
- Functions take the client as the first argument (`SupabaseClient<Database>`), so callers choose RLS or service role.
- Query modules import only types and `@supabase/supabase-js` types, never a client instance, so client components can import their pure helpers and constants (`formatTicketNumber`).
- A new module must be added to `exports` in `packages/supabase/package.json` as `./queries/<name>`; import it as `@repo/supabase/queries/<name>`.

## Realtime and types

- **Realtime subscriptions are the one database call allowed outside `queries/`:** open them in a `"use client"` hook with `createBrowserClient()` from `@repo/supabase/next/client` (RLS applies), and remove the channel on unmount. When Realtime is the right tool at all is in [performance.md](performance.md).
- **Import `Database` and `Json` with `import type`.** In client components, import them from `@repo/supabase/types/supabase`, never from the root `@repo/supabase` entry, which holds the service-role client.

## Migrations and types

- Migrations live in `supabase/migrations/`. Use a timestamp newer than the latest one on `staging`, and unique, because every worktree shares one local DB.
- **Locally:** apply with `supabase migration up --local`. Ask before `supabase db reset --local`.
- **Staging and production are migrated by CI, never by hand.** Merging to `staging` runs `.github/workflows/deploy-staging-db.yml`; merging to `main` runs `deploy-prod-db.yml` (dry run first, behind the `production` environment). Both only fire when `supabase/migrations/**` changed. Never run `supabase db push` against a remote project, and don't tell the user to.
- **Out-of-order migrations:** both workflows refuse a migration older than the remote's latest one. If that is intended (branches merged out of timestamp order), re-run the workflow manually with `include_all` on.
- **Every PR to `staging` or `main` that touches `supabase/` runs `.github/workflows/db-check.yml`** before merge, with no secrets and no remote database:
  - *Migration order & conflicts* (`.github/scripts/check-migrations.sh`): new migrations must be newer than the base branch's latest, be named `<14-digit timestamp>_<snake_case>.sql` with a unique timestamp, and never edit, rename or delete an existing migration. A `CREATE FUNCTION` for a function the base branch redefined after you branched fails too: rebase and start from the latest body.
  - *Apply migrations & DB tests*: a throwaway Postgres runs every migration from scratch plus `seed.sql`, then `supabase test db` (`supabase/tests/`).
  - Run the first check yourself before opening the PR: `git fetch origin && .github/scripts/check-migrations.sh origin/staging`. Fix what it finds first; don't open the PR with a warning in the description.
- **To check a migration landed,** look at the workflow run (`gh run list --workflow deploy-staging-db.yml`) rather than asking anyone to migrate.
- Types: `bun run gen-types` **at the repo root** regenerates `packages/supabase/src/types/supabase.ts` from the **local** DB (`--local`). Don't use the `gen-types` script inside `packages/supabase`, which doesn't read the local DB. The file can drift; hand-edit new columns if a full regen would pull in unrelated changes.
