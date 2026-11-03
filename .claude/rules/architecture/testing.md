---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "supabase/tests/**"
  - ".github/workflows/pr-check.yml"
---

# Testing

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md).

## What to test

- **Logic that decides something:** state machines, parsers, validators, auth and scope checks, rate limits, money and limits math, anything with an edge case you had to think about.
- **Every bug fix gets a test that fails without the fix.**
- **Security checks get both sides:** the allowed case and each refused case (wrong user, wrong scope, expired token, missing header).
- **Not worth a test:** pure wiring, one-line pass-throughs, generated code, styling.

## How

- **`bun test`, files next to the code** as `<file>.test.ts`. Web apps run with `SKIP_ENV_VALIDATION=1`.
- **Unit tests use no database, no network and no secrets.** `pr-check` runs affected tests without any. Mock the edges with `mock.module("@repo/supabase", ...)` (and the query module you call) before importing the code under test with `await import(...)`.
- **Time:** give the code an injectable `now` (the existing pattern), or use `setSystemTime()` and reset it at the end. Never `sleep` in a test.
- **Test the public function**, not private helpers. If something is hard to test, pass its dependencies in (`createX({ lookup, now })`) instead of reaching into module state.
- **Keep tests independent:** reset module-level state in `beforeEach`, use unique keys (ids, IPs) per test.
- **Database rules** (RLS policies, security-definer functions, triggers) are tested with pgTAP in `supabase/tests/database/` (see [database-migrations.md](database-migrations.md)), run with `bun run test:db` against the local DB only.

## Before you call it done

- `bun test` in every app and package you touched, and `bunx tsc --noEmit` in each app.
- A test you changed to make it pass needs a reason in the PR; never weaken an assertion to go green.
