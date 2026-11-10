---
paths:
  - "**/package.json"
  - "bun.lock"
  - ".github/dependabot.yml"
  - ".github/workflows/**"
  - "apps/*/Dockerfile"
---

# Adding and updating dependencies

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md).

- **Check before adding.** Look for a workspace package (`@repo/*`) or a dependency the repo already uses. One library per job: no second HTTP client, date library, schema validator (Zod), state store (zustand) or data-fetching hook (SWR).
- **Prefer the platform.** `fetch`, `crypto`, `URL`, `Intl` and Bun built-ins before a package.
- **Add it to the workspace that uses it** (`cd apps/<app> && bun add <pkg>`), not to the root. Root `devDependencies` are only for repo-wide tools (turbo, prettier, typescript).
- **Workspace packages** are `"@repo/<name>": "workspace:*"` in the user's `package.json`.
- **Commit `bun.lock` with every dependency change.** CI (`pr-check.yml`, `docs-check.yml`) and every Dockerfile run `bun install --frozen-lockfile`, so a PR whose lockfile doesn't match fails before merge.
- **Vet a new package:** maintained, widely used, a license compatible with MIT, no install scripts you didn't expect, and a real reason to exist in our code. Check the name for typos before installing.
- **Install scripts only run for `trustedDependencies`.** Add a package there only when it needs its install script (native builds like `sharp`), and say why in the PR.
- **Pin versions** of CLI tools run through `bunx`. GitHub Actions are pinned by full commit SHA with the version in a comment (`uses: owner/action@<sha> # vX.Y.Z`), never by a tag like `@v7`.
- **One Bun version per runtime:** `packageManager` in the root `package.json`, `bun-version` in the workflows and the `oven/bun` tag in each Dockerfile move together. If an app needs a newer Bun (the Next apps on 1.4.x), its Dockerfile says why in a comment.
- **Root `overrides`** are for two things only: a security fix (the version that fixes it) and pinning a library that must be a single copy across workspaces (next, `@sentry/*`). Say which in the PR. Remove an override once nothing needs it.
- **Updates are done by hand.** Dependabot version-update PRs are paused (`open-pull-requests-limit: 0`); only security updates open PRs. Update in a PR of its own, one per major version, after reading the changelog, and run types and tests in every app that uses the package. Every app with a Dockerfile is listed under the `docker` ecosystem in `.github/dependabot.yml`.
- **Removing code** removes the dependencies only it used.
