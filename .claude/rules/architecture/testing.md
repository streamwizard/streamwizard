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

- **`bun test`, files next to the code:** `<file>.test.ts` for one file, `<file>.<aspect>.test.ts` to split a big suite, or `<feature>.test.ts` in the feature's folder for behaviour across several files (a widget). Never in a separate `__tests__/` or `test/` tree; the only `test/` folder holds a Next app's `test/setup.ts` preload.
- **Running:** `bun test` in one workspace, `bunx turbo run test` at the root for all of them. Web apps run with `SKIP_ENV_VALIDATION=1`. web-streamwizard and web-overlay preload `test/setup.ts` through `bunfig.toml` `[test] preload`; it stubs `server-only`, so tests can import server-only modules. A Next app whose tests start importing one adds the same pair.
- **Unit tests use no database, no outside network and no secrets.** `pr-check` runs affected tests without any. A fake server on loopback (`Bun.serve({ port: 0 })`, stopped in `afterEach`) is fine for testing a client or socket; a real Supabase, Twitch or other remote host is not. Mock the edges with `mock.module("@repo/supabase", ...)` (and the query module you call) before importing the code under test with `await import(...)`.
- **`mock.module` is process-wide in `bun test`:** a mock stays in place for every later test file in the run. Keep every export: `const real = await import("<module>"); mock.module("<module>", () => ({ ...real, fnUnderTest: fake }))`. A mock that returns only the one function you need makes other files fail to link or quietly get your fake.
- **Env in tests:** prefer `mock.module("@/lib/env", () => ({ env: { ... } }))` (rest-api: `@/env`) before `await import(...)`. When the code reads `process.env` through a package's `env.ts`, set dummy, non-secret values with `??=` before the import, and restore any value you overwrite in `afterEach` / `afterAll`.
- **Time:** give the code an injectable `now` (the existing pattern), or use `setSystemTime()` and reset it at the end. Never wait a fixed number of milliseconds for something to happen. A zero-delay tick (`setTimeout(r, 0)`) to let pending promises settle is fine, and so is a bounded `waitFor(condition)` poll when the test drives a real loopback socket.
- **Test the public function**, not private helpers. If something is hard to test, pass its dependencies in (`createX({ lookup, now })`) instead of reaching into module state.
- **Keep tests independent:** use unique keys (ids, IPs) per test, and reset module-level state in `beforeEach`. Prefer passing state in (`createX({ ... })`). When a module must hold state (key caches, lockout counters), it exports one `reset<Thing>()` that tests call, and production code never does.
- **Database rules** (RLS policies, security-definer functions, triggers) are tested with pgTAP in `supabase/tests/database/<area>.test.sql` (see [database-migrations.md](database-migrations.md)), added in the same PR as the migration. Run them with `bun run test:db` against the local DB (never staging or prod). `db-check.yml` runs them on a fresh database for every PR that touches `supabase/`.

## Before you call it done

- `bun test` in every app and package you touched, and `bunx tsc --noEmit` in each app.
- A test you changed to make it pass needs a reason in the PR; never weaken an assertion to go green.
