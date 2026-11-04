# StreamWizard Architecture

StreamWizard is a Bun and TypeScript monorepo managed with Turborepo (`bun@1.3.5`, workspaces `apps/*` and `packages/*`). It contains the streamer-facing web app, an internal admin app, browser-source overlays, backend services and shared packages. Apps share code through `@repo/*` workspace packages.

This file is the shared rulebook. Every change, whoever or whatever makes it, should use the clients, helpers and patterns named here instead of inventing new ones. The detail lives in `.claude/rules/architecture/`. Claude Code loads each page automatically when it reads or edits a matching file (the `paths:` list at the top of each page); people can read them directly (table below). If a rule no longer matches the code, fix the rule in the same PR.

## Golden rules

1. **Database access goes through `packages/supabase/src/queries/*`.** No `.from()` in apps, routes, actions or components. A handful of legacy exceptions exist; do not add more.
2. **Pick the right Supabase client** ([database](.claude/rules/architecture/database.md)). Service-role clients are server-only.
3. **`process.env` appears only in `env.ts`.** Apps import the parsed `env` from `src/lib/env.ts`; packages take config as arguments, or read it in one lazily parsed `src/env.ts`. There is no shared `@repo/env` package ([env](.claude/rules/architecture/env.md)).
4. **Twitch Helix calls use `@repo/twitch-api`.** No ad hoc `fetch` to `api.twitch.tv`.
5. **Everything that crosses a boundary is parsed with Zod before use:** server action args, request params and bodies, webhooks, WebSocket queries and messages, node and service calls, JSON columns, uploads. Use `parsed.data`, never the raw input ([validation](.claude/rules/architecture/validation.md)).
6. **Machines prove who they are with short-lived signed tokens or per-node keys**, never a user's session: `@repo/service-token` for calls into ws-server, `@repo/node-token` for calls into OBS nodes, claim-issued API keys for nodes calling rest-api ([auth and security](.claude/rules/architecture/auth-and-security.md)).
7. **Shared behavior lives in a package; orchestration, routing and UI live in the owning app.** Check `packages/*` before writing a helper.
8. **Migrations: by hand only on the local DB; staging and prod are migrated by CI on merge.** `db-check` must pass on the PR ([database](.claude/rules/architecture/database.md)).
9. **Imports: `@/` inside apps, relative inside packages, `@repo/*` across workspaces** ([packages](.claude/rules/architecture/packages.md)).
10. **Bun services are organized by domain**: `modules/<domain>/` holds that domain's routes, logic, schemas and jobs; domain code never sees Hono `Context` ([backend services](.claude/rules/architecture/backend-services.md)).
11. **Server-side caches and per-key windows use `@repo/ttl-cache`.** No hand-rolled `Map` + timestamp caches, and never in client components ([caching](.claude/rules/architecture/caching.md)).
12. **Web app components live in `src/components/<feature>/`**, never in `src/app/`. Features don't import each other; shared pieces go in `components/shared/` ([web apps](.claude/rules/architecture/web-apps.md)).
13. **Prefer server actions over API routes** in the Next apps. Shared endpoints (webhooks, service and third-party callers) go in rest-api; a Next app only keeps route handlers that belong to it, like its auth callbacks ([web apps](.claude/rules/architecture/web-apps.md)).
14. **Every new Next.js page exports metadata.** Public pages: title, description, canonical, JSON-LD and a `PUBLIC_ROUTES` entry, written for Google and AI search. Signed-in pages: a title ([web apps](.claude/rules/architecture/web-apps.md)).
15. **No duplicated code.** Search before you write, reuse what exists, extract on the second copy. `bun run check:dupes` must pass ([duplicate code](.claude/rules/architecture/duplicate-code.md)).
16. **Packages are organized too:** one purpose each, domain folders inside `src/`, public API only through `exports`, no barrel files, a README ([packages](.claude/rules/architecture/packages.md)).
17. **Every new table has RLS on and its policies in the same migration;** `security definer` functions set `search_path = ''` ([database migrations](.claude/rules/architecture/database-migrations.md)).
18. **Unexpected errors go to Sentry via `@repo/sentry`; users, nodes and third parties only ever see a generic message.** Never log secrets ([errors and logging](.claude/rules/architecture/errors-and-logging.md)).
19. **Paid features check the plan on the server at every entry point:** `requireProductAccess()` on pages, the product's access helper in server actions, the subscription queries in rest-api; read-only plans show `FeatureDisabledBanner` ([paid features](.claude/rules/architecture/paid-features.md)).
20. **Branch off `staging`, commit only when asked, nothing sensitive in PR text** (public repo), Jira key in the branch, Done after merge ([git, PRs and Jira](.claude/rules/architecture/git-and-prs.md)).
21. **Logic and security checks get tests without a DB or network;** RLS and SQL functions get pgTAP tests ([testing](.claude/rules/architecture/testing.md)).
22. **Select only needed columns, never poll the DB in a tight loop,** fetch on the server in parallel ([performance](.claude/rules/architecture/performance.md)).
23. **Check for an existing package before adding a dependency;** one library per job, added to the workspace that uses it, `bun.lock` committed ([dependencies](.claude/rules/architecture/dependencies.md)).
24. **Analytics go through `@repo/posthog` and its event map, with no personal data** ([analytics](.claude/rules/architecture/analytics.md)).
25. **A module's API types are exported from that module; types shared with no single owner live in `src/types/<domain>.ts`; types only one file uses sit at the top of that file, unexported.** Zod-inferred types stay with their schema, props with their component ([types](.claude/rules/architecture/types.md)).
26. **Every rule a tool can check is checked in CI:** Biome, dependency-cruiser, knip and `check:dupes` must pass, baselines only go down ([repo hygiene](.claude/rules/architecture/repo-hygiene.md)).
27. **No dead code or clutter:** delete instead of commenting out, `docs/` holds lasting docs only (plans go to Confluence or Jira), every `TODO` names a Jira ticket, files stay under about 400 lines ([repo hygiene](.claude/rules/architecture/repo-hygiene.md)).

## Detail pages

| When you touch | Read |
|----------------|------|
| imports, a shared package, a new package | [.claude/rules/architecture/packages.md](.claude/rules/architecture/packages.md): import rules, package table, package layout |
| env vars, `process.env`, config in packages | [.claude/rules/architecture/env.md](.claude/rules/architecture/env.md) |
| Supabase clients, queries, migrations and their CI checks | [.claude/rules/architecture/database.md](.claude/rules/architecture/database.md) |
| auth, tokens, nodes, secrets, anything security-related | [.claude/rules/architecture/auth-and-security.md](.claude/rules/architecture/auth-and-security.md) |
| a Next.js app: server actions, API routes, pages, metadata, components, overlay widgets | [.claude/rules/architecture/web-apps.md](.claude/rules/architecture/web-apps.md) |
| a Bun service (rest-api, ws-server, bots, workers) or observability | [.claude/rules/architecture/backend-services.md](.claude/rules/architecture/backend-services.md) |
| a cache, cooldown or rate limit | [.claude/rules/architecture/caching.md](.claude/rules/architecture/caching.md) |
| similar-looking code, shared helpers, the dupes check | [.claude/rules/architecture/duplicate-code.md](.claude/rules/architecture/duplicate-code.md) |
| SQL migrations, RLS policies, SQL functions, pgTAP tests | [.claude/rules/architecture/database-migrations.md](.claude/rules/architecture/database-migrations.md) |
| error handling, Sentry, logging, error messages | [.claude/rules/architecture/errors-and-logging.md](.claude/rules/architecture/errors-and-logging.md) |
| anything behind a plan or product | [.claude/rules/architecture/paid-features.md](.claude/rules/architecture/paid-features.md) |
| tests | [.claude/rules/architecture/testing.md](.claude/rules/architecture/testing.md) |
| branches, commits, PRs, Jira (always loaded) | [.claude/rules/architecture/git-and-prs.md](.claude/rules/architecture/git-and-prs.md) |
| queries, polling, page data loading, bundle size | [.claude/rules/architecture/performance.md](.claude/rules/architecture/performance.md) |
| `package.json`, new or updated dependencies | [.claude/rules/architecture/dependencies.md](.claude/rules/architecture/dependencies.md) |
| PostHog events, feature flags, tracking | [.claude/rules/architecture/analytics.md](.claude/rules/architecture/analytics.md) |
| where a type lives, exporting types | [.claude/rules/architecture/types.md](.claude/rules/architecture/types.md) |
| validating input, Zod schemas | [.claude/rules/architecture/validation.md](.claude/rules/architecture/validation.md) |
| lint, dead code, docs folder, TODOs, CI checks, hooks | [.claude/rules/architecture/repo-hygiene.md](.claude/rules/architecture/repo-hygiene.md) |

## Applications

| App | Role | Stack |
|-----|------|-------|
| `apps/web-streamwizard` | Public site and streamer dashboard: Twitch integrations, clips, VODs, analytics, IRL, media, overlay editor. | Next.js App Router |
| `apps/web-overlay` | OBS browser-source playback, widget data APIs, telemetry. | Next.js App Router |
| `apps/web-admin` | Internal ops console: users, infra, OBS/ingest nodes, backups, alerts, CMS, Discord. | Next.js App Router |
| `apps/rest-api` | HTTP API: EventSub webhooks, clip sync, streams/ingest, OBS nodes, backups, pollers/jobs. | Bun, Hono |
| `apps/ws-server` | Real-time WebSocket service: overlay event fan-out, ingest-node traffic, monitor endpoints. | Bun WebSocket |
| `apps/streamwizard-bot` | Twitch EventSub/chat automation; forwards events to ws-server. | Bun |
| `apps/discord-bot` | Discord bot: commands, events, tickets, voice, logs, plus an internal HTTP API. | Bun, discord.js, Hono |
| `apps/obs-auto-switcher` | Watches stream/OBS health and switches scenes. | Bun |
| `apps/alert-worker` | Evaluates alert rules and sends notifications. | Bun, `@repo/alerting` |
| `apps/docs` | User and operator docs. | Mintlify |

Each app has a `README.md` with app-specific detail. `bun run dev:main` starts web-streamwizard, ws-server, web-admin, streamwizard-bot and web-overlay. App `dev` scripts run under Doppler (`doppler run --config dev_<app>`).

## Checking your work

- Types: run `bunx tsc --noEmit` inside each app you touched. `bun run check-types` at the root skips the apps.
- Tests: `bun test` in the app or package (web apps: `SKIP_ENV_VALIDATION=1 bun test`). Tests sit next to the code as `*.test.ts`.
- Duplicates: `bun run check:dupes` at the root (about 15 seconds).
- Lint, imports and dead code: Biome, dependency-cruiser and knip, once they are set up (see repo hygiene).
- Migrations: `.github/scripts/check-migrations.sh origin/staging` after `git fetch origin`, whenever the branch adds one.
- Debug against the local stack first. The prod DB is read-only.

## Keeping this current

This rulebook covers boundaries and conventions, not every route or message. When you add an app, a package, a new client type or a new pattern, or retire one, update the matching page in `.claude/rules/architecture/` in the same PR (and its `paths:` list if the files it covers moved), and the golden rule here if the rule itself changed.
