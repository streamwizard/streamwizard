# StreamWizard Backend Tools

StreamWizard.org is the ultimate toolkit for Twitch broadcasters, designed to enhance stream interactivity, automate content creation, and provide deep analytics. This repository contains the core backend infrastructure that powers the StreamWizard ecosystem.

## 🚀 Overview

This repository houses the core backend services and shared logic for Twitch integrations. It's built as a monorepo using [Turborepo](https://turbo.build/) and [Bun](https://bun.sh/).

### Core Features

- **Twitch EventSub Management**: Robust handling of real-time Twitch events (follows, subs, raids).
- **VOD & Clip Management**: Automated synchronization and organization of Twitch content.
- **Interactive SMP Bridge**: Real-time integration between Twitch events and Minecraft servers.
- **Shared Architecture**: Centralized types, configurations, and API clients used across all StreamWizard services.

## 📁 Repository Structure

```text
.
├── apps/
│   ├── rest-api/         # Hono-based API for frontend and webhooks
│   ├── streamwizard-bot/  # Dedicated bot for processing Twitch events
│   └── smp-bridge/       # Twitch-to-SMP integration service
└── packages/
    ├── twitch-api/       # Shared Twitch Helix API client
    ├── supabase/         # Shared database client and helpers
    ├── logger/           # Centralized logging utilities
    ├── types/           # Shared TypeScript interfaces (Helix, EventSub, etc)
    ├── env/             # Type-safe environment variable management
    ├── schemas/         # Zod validation schemas
    └── typescript-config/# Shared TS configuration
```

## 🛠 Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Monorepo Manager**: [Turborepo](https://turbo.build/)
- **Framework**: [Hono](https://hono.dev/)
- **Database**: [Supabase](https://supabase.com/) / PostgreSQL
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Validation**: [Zod](https://zod.dev/)

## 🏁 Getting Started

### Prerequisites

- [Bun](https://bun.sh/docs/installation) installed on your machine.
- A Twitch Developer Application for client IDs and secrets.
- A Supabase project for data storage.

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/streamwizard/streamwizard-backend.git
   cd streamwizard-backend
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Set up environment variables:
   Create a `.env` in the root and configure the necessary keys as defined in `@repo/env`.

4. Run development mode:
   ```bash
   bun dev
   ```

## 📜 Available Scripts

- `bun dev`: Starts all applications in development mode.
- `bun build`: Builds all applications for production.
- `bun lint`: Runs linting across the entire workspace.
- `bun format`: Formats code using Prettier.
- `bun check-types`: Validates TypeScript types across all packages.

## 🐛 Reporting issues

Found a bug? Something's slow? Docs are wrong? You have two options — pick whichever is less annoying:

- **GitHub** — [open an issue](https://github.com/streamwizard/streamwizard/issues) using one of the templates
- **Discord** — use the StreamWizard bot in the [community server](https://discord.gg/29Eq659egv). `/bug`, `/feature`, `/docs`, and `/perf` create the GitHub issue for you without leaving Discord

Both routes end up in the same place.

## 📄 License

This project is licensed under the MIT License.
