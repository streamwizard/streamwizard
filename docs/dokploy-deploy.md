# Dokploy deployment settings

All app Dockerfiles in this monorepo expect the **Docker build context to be the
repository root** (`.`), because they install the whole Bun workspace and copy
shared `packages/`. If an app's context is scoped to its own folder, `bun install`
fails to resolve the `@repo/*` workspace packages:

```
error: Workspace dependency "@repo/supabase" not found
Searched in "./*"
```

## Required settings per app

For every app, set these in the Dokploy application's **Build** section:

| Setting              | Value                              |
| -------------------- | ---------------------------------- |
| Docker Context Path  | `.`                                |
| Docker File          | `apps/<app-name>/Dockerfile`       |

Examples:

| App              | Docker File                          |
| ---------------- | ------------------------------------ |
| discord-bot      | `apps/discord-bot/Dockerfile`        |
| rest-api         | `apps/rest-api/Dockerfile`           |
| streamwizard-bot | `apps/streamwizard-bot/Dockerfile`   |
| ws-server        | `apps/ws-server/Dockerfile`          |
| web-overlay      | `apps/web-overlay/Dockerfile`        |
| web-streamwizard | `apps/web-streamwizard/Dockerfile`   |

The Dockerfile path is relative to the context root, so it keeps the
`apps/<app-name>/` prefix even though the context is `.`.

## How to confirm the context is correct

In the build log, check the context transfer near the top:

- ✅ Correct (repo root): `transferring context: <several> MB` and the
  `.dockerignore` load shows a few hundred bytes (the repo-root `.dockerignore`).
- ❌ Wrong (app folder): `transferring context: ~68 kB` and `.dockerignore`
  shows `2B` — the context is the app directory and `packages/` is missing.
