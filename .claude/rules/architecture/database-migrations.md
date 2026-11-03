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
- **Service-role-only tables** (keys, secrets, node credentials, queues) get RLS on, no policies, and `revoke all ... from anon, authenticated`. Say so in a comment.
- **Least privilege on grants.** Grant only the operations the app needs (`select` only for read-only data). Column-level grants for tables that mix public and private columns.
- **Types and defaults:** `uuid` primary keys (`default gen_random_uuid()`), `timestamptz` with `default now()`, `text` plus a `check` constraint instead of new enums, `not null` unless null means something.
- **Foreign keys** say what happens on delete (`on delete cascade` or `set null`) and get an index.
- **Names:** `snake_case`, plural table names, `<table>_<column>_idx` / `_key` / `_check` for constraints and indexes.

## Functions and triggers

- **`security definer` only when needed**, and then always `set search_path = ''` with every object schema-qualified (`public.users`). Revoke `execute` from `public` and grant it only to the roles that call it.
- **Prefer `security invoker`** (the default) so RLS still applies.
- **Redefining a function:** start from its latest body in the newest migration that defines it, not from memory or an old branch.
- **Triggers** for `updated_at` and derived columns, not app code that has to remember.
- **Cron jobs** (`pg_cron`) are created and unscheduled in migrations, with an idempotent `unschedule` before `schedule`.

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
