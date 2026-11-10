---
paths:
  - "apps/*/src/**"
  - "packages/*/src/**"
  - "apps/*/next.config.*"
---

# Environment variables

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md).

**`process.env.SOMETHING` appears in exactly one place per app or package: its `env.ts`.** Everything else imports the parsed, typed `env` object.

## In apps

- **Each app has one schema:** `src/lib/env.ts` (rest-api: `src/env.ts` parsing `src/schemas/env.ts`). Next apps use `@t3-oss/env-nextjs` `createEnv` with separate `server` and `client` sections; Bun services use a plain Zod schema parsed at startup.
- **Everywhere else: `import { env } from "@/lib/env"`.** Never `process.env.X` in components, actions, routes, modules or helpers, and that includes `NODE_ENV` and `PORT`.
- **`NODE_ENV` and `APP_ENV` go in the `shared` section of `createEnv`** in Next apps, so client components can read `env.NODE_ENV` too (all three schemas still have `NODE_ENV` under `server`; move it when you touch the file). Use `APP_ENV` (baked in by `next.config.ts`) when you need the real environment name, because the standalone server forces `NODE_ENV=production`.
- **The schema lists every variable the app needs, including those its packages read**, so a missing or malformed value stops the app at boot instead of failing later on a request.
- **Validate properly:** `z.url()` for URLs, including `ws://` and `wss://` (`z.string().url()` is the deprecated Zod 4 form; existing schemas use it, so switch when you touch them), `z.coerce.number().int()` for ports and intervals, `z.enum([...])` for modes, `.min(1)` on secrets, a `.default()` only when a safe default exists. Optional features use `.optional()` and the code checks for them.
- **Browser values:** only `NEXT_PUBLIC_*` variables, only through the `client` section. Next apps derive them from the non-prefixed Doppler names inside `env.ts` and `next.config.ts`; keep both in sync. Never put a secret in a `NEXT_PUBLIC_*` variable.
- **Allowed exceptions** (they run before `env.ts` can load): `sentry.ts` preload files, `instrumentation*.ts` and `next.config.*` may read the few variables they need directly.

## In packages

1. **Preferred: the package takes config as arguments.** Export a factory or init function with explicit options (`createServiceAuth({ jwks })`, `createClient({ url, key })`), and the app passes values from its own `env`. The package then reads no environment at all, which keeps it testable and makes its needs visible in the call.
2. **When a package must read the environment itself** (shared singletons many apps use, like the Supabase service client, token signers, metrics, Sentry): all reads go in **one file, `src/env.ts`**, with a Zod schema.
   - Parse **lazily**, on first use, not at import, so an app that never uses that part doesn't need the variable.
   - Throw an error that names the missing variable.
   - List every variable in the package README.
   - No `process.env` anywhere else in the package.
3. **Packages that run in the browser** (`@repo/ui`, client parts of `@repo/posthog`) never read the environment; values come in as props or options.
4. **One name per variable across the repo,** the same as in Doppler. Two fallbacks are allowed and no others: (a) server code shared by Next apps and Bun services may read `X` and fall back to its derived `NEXT_PUBLIC_X` (or the reverse); (b) each app's Sentry DSN is `SENTRY_DSN_<APP>`, falling back to `SENTRY_DSN`. Each `NEXT_PUBLIC_X` derived in `next.config.ts` must be derived the same way in `env.ts`.

## Adding a variable

1. Add it to the schema of every app (and package `env.ts`) that reads it.
2. Add it to each Doppler config that app runs in (dev, staging, production). Ask before writing to Doppler.
3. Mention it in the app or package README, and in the PR description (name only, never the value).

Never commit values or `.env` files. Web-app tests run with `SKIP_ENV_VALIDATION=1`.

**Current state:** 11 packages read `process.env` directly and none has a `src/env.ts` yet: `@repo/supabase` (8 files), `@repo/ui` (14 widget files, `NEXT_PUBLIC_WS_SERVER_URL`), `@repo/metrics` (3), `@repo/alerting` (`config.ts` lazy getters, no Zod), `@repo/twitch-api`, `@repo/discord-api`, `@repo/posthog`, `@repo/sentry`, `@repo/service-token`, `@repo/node-token`, `@repo/telegram-api`. Most have no README, or one that doesn't list the variables. Move the reads into `src/env.ts`, or switch to passed-in config, when you touch them. New package code takes config as arguments.
