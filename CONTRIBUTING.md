# Contributing to StreamWizard

First of all — thank you for wanting to help! This guide is written for everyone, including people who have never contributed to an open source project before. Take it step by step and don't hesitate to ask questions by opening a [GitHub Discussion](https://github.com/streamwizard/streamwizard-backend/discussions).

---

## Table of Contents

1. [Before You Start](#1-before-you-start)
2. [Understanding the Project](#2-understanding-the-project)
3. [Setting Up Your Environment](#3-setting-up-your-environment)
4. [Setting Up Supabase](#4-setting-up-supabase)
5. [Forking the Repository](#5-forking-the-repository)
6. [Making Your Changes](#6-making-your-changes)
7. [Opening a Pull Request](#7-opening-a-pull-request)
8. [The Review Process](#8-the-review-process)
9. [Branch Rules](#9-branch-rules)
10. [Code Style](#10-code-style)
11. [Need Help?](#11-need-help)

---

## 1. Before You Start

Make sure you have the following installed on your computer:

| Tool | Why you need it | Install guide |
|------|----------------|---------------|
| [Git](https://git-scm.com/) | Tracks changes to code | [git-scm.com/downloads](https://git-scm.com/downloads) |
| [Bun](https://bun.sh/) | Runs the project (like Node.js but faster) | [bun.sh/docs/installation](https://bun.sh/docs/installation) |
| [Supabase CLI](https://supabase.com/docs/guides/cli) | Manages the local database | [supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli) |
| [Docker](https://www.docker.com/) | Required by the Supabase CLI locally | [docs.docker.com/get-docker](https://docs.docker.com/get-docker/) |
| A [GitHub account](https://github.com/signup) | To submit your changes | [github.com/signup](https://github.com/signup) |

To check if something is installed, open your terminal and run:

```bash
git --version
bun --version
supabase --version
docker --version
```

If you see a version number, you're good. If you get an error, follow the install guide for that tool.

---

## 2. Understanding the Project

StreamWizard is a **monorepo** — one repository that contains multiple apps and shared packages. Here's the structure:

```
streamwizard-backend/
├── apps/
│   ├── rest-api/          # The main API (Hono framework)
│   ├── streamwizard-bot/  # Processes Twitch events
│   ├── ws-server/         # WebSocket server
│   ├── smp-bridge/        # Twitch ↔ Minecraft integration
│   ├── discord-bot/       # Discord bot
│   ├── clip-sync/         # Syncs Twitch clips
│   ├── web-streamwizard/  # Main web app
│   ├── web-overlay/       # Twitch overlay app
│   └── web-monitor/       # Monitoring dashboard
└── packages/
    ├── supabase/          # Database client and types
    ├── twitch-api/        # Twitch API client
    ├── types/             # Shared TypeScript types
    ├── schemas/           # Zod validation schemas
    ├── logger/            # Logging utilities
    └── ui/                # Shared UI components
```

The monorepo is managed with [Turborepo](https://turbo.build/), which lets you run commands across all apps at once.

---

## 3. Setting Up Your Environment

### Step 1 — Fork and clone the repo

> **What is forking?** Forking creates your own personal copy of the repository on GitHub. You make changes there, then propose them back to the original project.

1. Go to [github.com/streamwizard/streamwizard-backend](https://github.com/streamwizard/streamwizard-backend)
2. Click the **Fork** button in the top-right corner
3. Click **Create fork**

Now clone your fork to your computer:

```bash
git clone https://github.com/YOUR-USERNAME/streamwizard-backend.git
cd streamwizard-backend
```

Replace `YOUR-USERNAME` with your GitHub username.

### Step 2 — Add the original repo as upstream

This lets you pull in future updates from the main project:

```bash
git remote add upstream https://github.com/streamwizard/streamwizard-backend.git
```

Verify it worked:

```bash
git remote -v
```

You should see both `origin` (your fork) and `upstream` (the original).

### Step 3 — Install dependencies

```bash
bun install
```

### Step 4 — Set up environment variables

The project uses [Doppler](https://www.doppler.com/) for secrets management in production, but for local development you use a `.env` file.

Copy the example env file:

```bash
cp .env.example .env
```

> If there is no `.env.example`, ask in the [Discussions](https://github.com/streamwizard/streamwizard-backend/discussions) and someone will help you figure out which variables you need for the part you're working on. You don't need all variables — only the ones relevant to your change.

---

## 4. Setting Up Supabase

StreamWizard uses [Supabase](https://supabase.com/) as its database. For local development you run a **local Supabase instance** using Docker — this means you never touch the real production or staging database.

### Step 1 — Start the local Supabase stack

Make sure Docker is running, then:

```bash
supabase start
```

This will download and start a local Postgres database, auth server, and Supabase Studio. It may take a few minutes the first time.

When it's done you'll see output like:

```
API URL: http://127.0.0.1:54321
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
```

### Step 2 — Apply migrations

Apply all existing database migrations to your local database:

```bash
supabase db push --local
```

### Step 3 — Access Supabase Studio

Open [http://127.0.0.1:54323](http://127.0.0.1:54323) in your browser to see and interact with your local database through a visual interface — just like the real Supabase dashboard.

### Step 4 — Making database changes

If your contribution requires a database change (new table, new column, etc.):

1. Make the change in Supabase Studio locally first to test it
2. Generate a migration file:

```bash
supabase db diff -f your_migration_name
```

This creates a new file in `supabase/migrations/` that captures your change. **Always commit this file** — it's how the change gets applied to staging and production automatically.

### Step 5 — Stop the local stack

When you're done working:

```bash
supabase stop
```

> **Important:** Never point your local development at the staging or production Supabase URL. Always use the local instance.

---

## 5. Forking the Repository

You already forked in Step 3, but here's a recap of the full mental model:

```
Original repo (streamwizard/streamwizard-backend)
        ↓  fork
Your fork (YOUR-USERNAME/streamwizard-backend)
        ↓  clone
Your computer
```

When you're ready to submit changes, the flow goes back up:

```
Your computer
        ↓  push
Your fork (YOUR-USERNAME/streamwizard-backend)
        ↓  Pull Request
Original repo → staging branch
```

---

## 6. Making Your Changes

### Step 1 — Sync with the latest staging branch

Before starting any work, make sure your local copy is up to date:

```bash
git fetch upstream
git checkout staging
git merge upstream/staging
```

### Step 2 — Create a feature branch

Never work directly on `staging` or `main`. Always create a new branch for your change:

```bash
git checkout -b feature/your-feature-name
```

Use a descriptive name, for example:
- `feature/add-clip-sorting`
- `fix/ws-server-reconnect`
- `docs/update-readme`

### Step 3 — Make your changes

Edit the code, test your changes locally, then commit:

```bash
git add .
git commit -m "feat: add clip sorting by view count"
```

Try to follow this commit message format:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `chore:` for maintenance tasks

### Step 4 — Push to your fork

```bash
git push origin feature/your-feature-name
```

---

## 7. Opening a Pull Request

> **What is a Pull Request (PR)?** A PR is a proposal to merge your changes into the project. It lets the maintainer review your code before it goes live.

1. Go to your fork on GitHub: `github.com/YOUR-USERNAME/streamwizard-backend`
2. You'll see a banner saying **"Compare & pull request"** — click it
3. **Important:** Make sure the base repository is `streamwizard/streamwizard-backend` and the base branch is **`staging`** — not `main`

    > If you accidentally target `main`, close the PR and open a new one targeting `staging`.

4. Fill in the PR template:
   - **Title**: Short description of what you changed
   - **Description**: What does this change do? Why is it needed? Include screenshots if it's a UI change.
   - **Testing**: Describe how you tested it locally

5. Click **Create pull request**

---

## 8. The Review Process

Once your PR is open:

1. A maintainer will review your code and may leave comments asking for changes
2. Make the requested changes on your branch and push again — the PR updates automatically
3. Once approved, the maintainer will merge your PR into `staging`
4. The staging database migration pipeline runs automatically
5. After verification on staging, changes are promoted to `main` and production

Be patient — reviews can take a few days. If you haven't heard back in a week, feel free to leave a comment on the PR.

---

## 9. Branch Rules

| Branch | Purpose | Who can PR here |
|--------|---------|-----------------|
| `main` | Production — what real users see | Maintainers only (from `staging`) |
| `staging` | Staging — tested before going live | Anyone via a fork |

**Never open a PR directly against `main`.** All contributions go through `staging` first.

---

## 10. Code Style

The project uses [Prettier](https://prettier.io/) for formatting and [ESLint](https://eslint.org/) for linting.

Before committing, run:

```bash
bun format   # auto-formats your code
bun lint     # checks for code issues
bun check-types  # checks TypeScript types
```

Fix any errors before opening a PR — PRs with failing checks will not be merged.

---

## 11. Need Help?

- **Something not working?** Open a [GitHub Discussion](https://github.com/streamwizard/streamwizard-backend/discussions)
- **Found a bug?** Open a [GitHub Issue](https://github.com/streamwizard/streamwizard-backend/issues)
- **Not sure where to start?** Look for issues labeled `good first issue`

No question is too basic. Everyone starts somewhere.
