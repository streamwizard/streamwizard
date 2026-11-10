---
paths:
  - "supabase/migrations/**"
  - "supabase/tests/**"
  - "supabase/seed.sql"
---

# Writing database migrations

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md); how migrations are applied and checked in CI is in [database.md](database.md).

The CI check catches ordering problems, not insecure SQL. These rules cover the SQL itself.

## Tables

- **Every new table enables RLS** in the same migration that creates it (`alter table ... enable row level security`). No exceptions.
- **Write the policies with the table.** Owner access compares `user_id` to `(select auth.uid())` (the `select` wrapper lets Postgres cache it per statement). Admin access uses the existing helpers (`is_strong_admin()`), never a hand-written role check.
- **Ownership without a `user_id`:** tables keyed by a Twitch channel check `public.user_owns_channel(broadcaster_id)`. Child rows (overlay items, groups, widget instances) check the parent: `EXISTS (SELECT 1 FROM public.overlay_scenes s WHERE s.id = <table>.scene_id AND s.user_id = (SELECT auth.uid()))`, in both `USING` and `WITH CHECK`, so a row can't be moved under someone else's parent.
- **Service-role-only tables** (keys, secrets, node credentials, queues) get RLS on, no policies, and `revoke all ... from anon, authenticated`. Say so in a comment.
- **Least privilege on grants.** Supabase's default privileges give `anon` and `authenticated` every privilege (including `TRUNCATE`) on a new `public` table and `EXECUTE` on a new function. In the migration that creates the table, `revoke all on public.<table> from anon, authenticated`, then grant back only what the app uses (`select` only for read-only data; column-level `grant select (...)` / `grant update (...)` when a table mixes public and private columns). For a new function, `revoke all on function ... from public, anon` and grant `execute` to the roles that call it.
- **Keys, types and defaults:** entity tables use `uuid` primary keys (`default gen_random_uuid()`). Exceptions on purpose: append-only logs and queues use `bigint generated always as identity`; join tables use a composite primary key of their two FKs; one-row-per-owner tables use the owner column (`user_id`, `guild_id`, `broadcaster_id`) as the key; rows keyed by an external id (Discord snowflake, Twitch id) use that `text` id. `timestamptz` with `default now()`, `text` plus a `check` constraint instead of new enums, `not null` unless null means something.
- **Foreign keys** say what happens on delete (`on delete cascade` or `set null`) and get an index.
- **Names:** `snake_case`, plural table names, `<table>_<column>_idx` / `_key` / `_check` for constraints and indexes.
- **Views** in `public` (or any schema PostgREST exposes) are created `with (security_invoker = true)` so RLS applies. Owner-rights views (`security_invoker = false`) live only in the non-exposed `analytics` schema, list safe columns explicitly (no tokens, secrets, IPs or free text), and are readable only by `analytics_reader`.
- **Realtime:** add a table to `supabase_realtime` only in a migration that also has a `SELECT` policy for the role that subscribes (`is_strong_admin()` for admin views). Realtime sends only the rows that policy allows. Leave tables no browser needs out of the publication, with a comment saying why.

## Functions and triggers

- **`security definer` only when needed**, and then always `set search_path = ''` with every object schema-qualified (`public.users`). Revoke `execute` from `public` and grant it only to the roles that call it.
- **Prefer `security invoker`** (the default) so RLS still applies.
- **Redefining a function:** start from its latest body in the newest migration that defines it, not from memory or an old branch.
- **Triggers** for `updated_at` and derived columns, not app code that has to remember. Every table with `updated_at` gets `CREATE OR REPLACE TRIGGER <table>_updated_at BEFORE UPDATE ON public.<table> FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();` in the migration that adds the column. Don't write a new `updated_at` function.
- **Cron jobs** (`pg_cron`) are created and removed in migrations. Always pass a job name (`cron.schedule('purge-x', '17 3 * * *', $$ SELECT public.purge_x(); $$)`); a named schedule replaces the existing job, so it is safe to re-run. The job calls a `security definer` function with `execute` revoked from `public, anon, authenticated`. To retire a job, unschedule it guarded by `IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = '...')`.

## Changing existing schema

- **Never edit an applied migration.** Add a new one.
- **Destructive changes in two steps:** stop using the column/table in code and ship that first; drop it in a later migration.
- **Backfills** that touch many rows run in batches or as a one-off job, not inside a schema migration that locks the table.
- **Keep it idempotent where cheap** (`if not exists`, `drop ... if exists`), so a partial local run can be re-applied.

## Tests

- **New policies, security-definer functions and triggers get a pgTAP test** in `supabase/tests/database/<topic>.test.sql`.
- Test as each role that matters: an owner, another user, `anon`, and the service role. Assert both what is allowed and what is refused.
- Run them locally with `bun run test:db` (local DB only); CI runs them on every PR that touches `supabase/`.

## After writing one

- Apply locally (`supabase migration up --local`), then hand-edit or regenerate `packages/supabase/src/types/supabase.ts` from the local DB.
- Add or update the query functions in `packages/supabase/src/queries/` in the same PR.
