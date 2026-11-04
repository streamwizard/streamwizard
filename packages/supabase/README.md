# @repo/supabase

Shared database client and utility functions for the StreamWizard platform, built on top of [Supabase](https://supabase.com/).

## 🚀 Overview

This package centralizes all database interactions, ensuring consistent schema access and helper logic across all applications in the monorepo.

## 🛠 Features

- **Centralized Client**: Single source of truth for the Supabase client initialization.
- **Type Safety**: Includes generated types for the entire database schema.
- **Token Cryptography**: Secure helpers for encrypting and decrypting Twitch tokens before storage.
- **Migrations**: Tracks the evolution of the database schema (see `migrations/`).

## 📁 Entry points

Every entry point is listed in `exports` in `package.json`; anything else is private.

- `@repo/supabase`: the service-role `supabase` client and the `Database` / `Json` types.
- `@repo/supabase/next/server`, `/next/client`, `/next/admin`, `/next/proxy`: clients for the Next apps.
- `@repo/supabase/anon`, `/request-client`: the anon client and a per-request client.
- `@repo/supabase/auth/session-strength`: the admin session-strength check.
- `@repo/supabase/crypto`: AES-256-GCM encryption for tokens and node keys.
- `@repo/supabase/types/supabase`: the generated `Database` types (type-only, safe in client code).
- `@repo/supabase/queries/*`: every file in `src/queries/`, by its path. One file per domain, with related files grouped in a folder named after the domain (`queries/discord/voice`, `queries/tickets/config`, `queries/obs-nodes/instances`, `queries/twitch/tokens`). No barrels: import the file that has the function.

Internal helpers (`with-metrics`, `clip-folder-utils`, `fetch-all-pages`) live in `src/lib/` and are never exported.

## 🔑 Environment variables

- `SUPABASE_URL` (falls back to `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SECRET_KEY`: the service-role client.
- `SUPABASE_PUBLIC_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the anon and Next clients.
- `TOKEN_ENCRYPTION_KEY`: `crypto` and the Twitch token helpers.

## 🏁 Usage

```typescript
import { supabase } from "@repo/supabase";

const { data, error } = await supabase
  .from("broadcaster_live_status")
  .select("*")
  .eq("is_live", true);
```

## 🛠 Database Schema

Key tables managed by this package:

- `integrations_twitch`: Stores user tokens and profile data.
- `broadcaster_live_status`: Real-time tracking of who is live.
- `stream_events`: Historical log of all processed EventSub events.
- `stream_viewer_counts`: Snapshots of viewer counts for analytics.
