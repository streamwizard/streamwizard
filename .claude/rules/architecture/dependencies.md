---
paths:
  - "**/package.json"
  - "bun.lock"
  - ".github/dependabot.yml"
---

# Adding and updating dependencies

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md).

- **Check before adding.** Look for a workspace package (`@repo/*`) or a dependency the repo already uses. One library per job: no second HTTP client, date library, schema validator (Zod), state store (zustand) or data-fetching hook (SWR).
- **Prefer the platform.** `fetch`, `crypto`, `URL`, `Intl` and Bun built-ins before a package.
- **Add it to the workspace that uses it** (`cd apps/<app> && bun add <pkg>`), not to the root. Root `devDependencies` are only for repo-wide tools (turbo, prettier, typescript).
- **Workspace packages** are `"@repo/<name>": "workspace:*"` in the user's `package.json`.
- **Commit `bun.lock` with every dependency change.** Docker builds use `bun install --frozen-lockfile` and fail on a lockfile that doesn't match.
- **Vet a new package:** maintained, widely used, a license compatible with MIT, no install scripts you didn't expect, and a real reason to exist in our code. Check the name for typos before installing.
- **Pin versions** of CLI tools run through `bunx` and of GitHub Actions (`uses: owner/action@<sha> # vX`).
- **Security overrides** go in the root `overrides`, with the version that fixes the issue. Remove an override once nothing needs it.
- **Updates:** Dependabot opens the PRs. Major versions get their own PR and a read of the changelog; run types and tests in every app that uses the package.
- **Removing code** removes the dependencies only it used.
