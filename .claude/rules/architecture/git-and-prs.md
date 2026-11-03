# Git, PRs and Jira

Part of the StreamWizard rulebook; this page has no `paths:` list, so Claude Code loads it in every session. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md).

## Branches

- **Branch off `staging`.** PRs always target `staging`; never `main` or `production`. `main` is what production runs.
- **Name branches** `<type>/<jira-key>-<short-slug>` when there is a ticket (`fix/sw-494-service-tokens`), `<type>/<slug>` when there isn't. Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `perf`.
- **Side fixes get their own worktree** off `staging` (`git worktree add ../sw-<slug> -b fix/<slug> origin/staging`), so they don't mix with the branch you're on. All worktrees share one local DB, so keep migration timestamps unique.

## Agent and editor config

- **Agent and editor config lives at the repo root only:** `.claude/` (settings, rules, agents), `CLAUDE.md`, `.mcp.json`, `.vscode/`. No `.claude/`, `.cursor/`, `.vscode/` or `.mcp.json` inside apps or packages, and no app-level settings files.
- **Start sessions from the repo root.** A session started inside an app writes its own `.claude/settings.local.json` there.
- **Rules for one app or folder** go in `.claude/rules/` with a `paths:` list, not in a `CLAUDE.md` inside that folder.
- **Exception: the Next.js agent files.** `next dev` writes `AGENTS.md` (and a `CLAUDE.md` that imports it) in each Next app when an agent runs it, and recreates them if they're deleted. Keep them committed and don't edit inside the `nextjs-agent-rules` markers.
- **Tool caches** (`.impeccable/`, `.turbo/`, `.next/`) stay git-ignored and are never committed.

## Commits

- **Commit only when asked.** Each commit needs its own go-ahead; don't push without one either.
- **Messages:** short imperative subject (`Return generic errors from OBS instance CRUD`), body explains why when it isn't obvious. One logical change per commit.
- **Never commit** secrets, `.env` files, local scratch files, or changes you didn't make and weren't asked to include. Stage specific paths, not `git add -A`, on a dirty tree.

## Pull requests

- **Run the checks first:** types, tests, `bun run check:dupes`, and `.github/scripts/check-migrations.sh origin/staging` when the branch adds a migration. Fix problems before opening the PR; a warning in the description is not enough, PRs get merged fast.
- **Follow `.github/pull_request_template.md`.** Say what changed, why, how it was tested, and the deploy order when more than one service or repo is involved.
- **This repo is public.** PR titles, descriptions, commits and code comments describe what changed, never an unfixed weakness, a way to bypass a check, a server address or an internal hostname. Put that detail in Jira.
- **Keep PRs focused:** one ticket or one concern. A restructure or rename is its own PR, not mixed into a feature.

## Jira

- Tickets live in the `SW` project. Security work goes under the Security epic, others under their feature epic.
- **Put the Jira key in the branch name and PR title** so they link.
- **Move the ticket to Done after the PR merges**, not when it opens. Leave a comment with the PR link and anything left over (manual deploy step, follow-up ticket).
- Follow-ups found while working get their own ticket instead of growing the current PR.
