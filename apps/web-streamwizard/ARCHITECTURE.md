# StreamWizard Web App — Architecture

## Routing

The app uses Next.js App Router with two main route groups:

- `app/(auth)/` — Public auth flows (login, OAuth callback). No session required.
- `app/(protected)/dashboard/` — Authenticated dashboard. The layout at `app/(protected)/dashboard/layout.tsx` checks `auth.getUser()` and redirects to `/login` on failure.
- `app/api/` — REST API routes consumed by the OBS overlay app (`apps/web-overlay`). These use the admin Supabase client (`@repo/supabase/next/admin`) since they are unauthenticated public endpoints.

## Server Actions

All mutations go through Next.js Server Actions in `src/actions/`. The pattern is:

1. Call `getAuthContext()` from `src/lib/auth.ts` to get `{ supabase, user, broadcasterId }`.
2. Validate input (Zod schemas from `src/schemas/`).
3. Call a query function from `@repo/supabase/queries/*` — never query Supabase directly.
4. Return a plain `{ data, error }` or `{ success, error }` object.

## Database Access Rule

**Every Supabase `.from()` call must live in `packages/supabase/src/queries/*.ts`.**

No raw Supabase queries in app routes, action files, or components. Query functions accept a typed `DBClient = SupabaseClient<Database>` as the first parameter.

Existing query files:
| File | Tables covered |
|------|---------------|
| `queries/clips.ts` | `clips`, `clip_folders`, `clip_folder_junction` |
| `queries/commands.ts` | `commands` |
| `queries/overlays.ts` | `overlay_scenes`, `overlay_items` |
| `queries/public.ts` | `testimonials` |
| `queries/stream-analytics.ts` | `streams`, `stream_events`, `viewer_counts` |
| `queries/user.ts` | `integrations_twitch`, `user_preferences` |
| `queries/vods.ts` | `vods`, `pending_clips` |

## Server vs Client Components

- Pages and layouts are **Server Components** by default.
- Interactive UI (editors, modals, forms) uses `"use client"` components.
- Server Actions bridge the gap: client components call them to mutate data without an explicit API layer.

## Package Dependencies

```
apps/web-streamwizard
  ├── @repo/supabase      — Supabase client + all DB query functions
  ├── @repo/twitch-api    — Typed Twitch Helix API client
  ├── @repo/ui            — Shared React components + overlay types
  ├── @repo/env           — Backend environment variable schema (Zod)
  └── @repo/types         — Shared TypeScript types (Twitch Helix response shapes)
```

The web app has its own env schema at `src/lib/env.ts` (using `@t3-oss/env-nextjs`) for client-side and Next.js-specific variables.

## Overlay System

Overlays are composed of **scenes** (`overlay_scenes`) containing **items** (`overlay_items`). The canonical type definitions live in `packages/ui/src/components/overlay/types.ts` and are re-exported from `apps/web-streamwizard/src/types/overlays.ts`.

The public overlay API (`app/api/overlays/[slug]/`) is consumed by `apps/web-overlay` (an OBS browser source). It uses the admin client and does not require authentication.
