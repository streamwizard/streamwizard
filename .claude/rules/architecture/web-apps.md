---
paths:
  - "apps/web-streamwizard/**"
  - "apps/web-admin/**"
  - "apps/web-overlay/**"
  - "packages/ui/**"
---

# Web apps

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md); this page has the detail.

## Web apps

All three use the Next.js App Router (Next 16, which differs from older docs: read `node_modules/next/dist/docs/` before using an unfamiliar API). Route handlers live in `src/app/api`, except auth callbacks (`(auth)/auth/...`) and generated files (`llms.txt/route.ts`, `sitemap.ts`, `robots.ts`). Server-only code stays out of client components.

- **Mark server-only modules.** Any `src/lib/` or `src/server/` file that imports `supabaseAdmin`, `next/headers`, a token signer or a server-only env value starts with `import "server-only";` (add `server-only` to the app's dependencies). The build then fails if a client component imports it. Pure helpers that the client also needs go in their own file.

### Server actions vs API routes

**Default to server actions** (`"use server"` functions in `src/actions/`) whenever our own React code needs the server: form submits, button clicks, saves, deletes, toggles. They are typed end to end, need no fetch code or URL, and can revalidate the page in the same round trip.

- **Reads go in server components**, not in a server action and not in a `fetch` to our own API. Load data where the page renders it.
- **Client-side reads after load** (filters, search-as-you-type): call a server action if it's occasional. The client runs server actions one at a time, so frequent polling or parallel reads need a route handler (below).
- **Shared backend endpoints go in `apps/rest-api`, not in a Next app:** webhooks (Twitch EventSub, Proxmox, ...), anything another service, a node or a third party calls, and any endpoint more than one app uses. If you're unsure where an endpoint belongs, it belongs in rest-api.
- **A Next app keeps a route handler (`src/app/.../route.ts`) only when it belongs to that app itself:**
  - its own sign-in callbacks (OAuth / Supabase auth callback, Discord account link)
  - its own `/api/health` probe
  - endpoints its own pages poll or read in parallel (web-admin metrics panels, overlay widget state in web-overlay)
  - streaming responses, uploads and downloads for its own UI
  - fire-and-forget writes that must not queue behind other actions (the `/api/activity` analytics relay)
  - cached proxies of public third-party data for its own UI (`/api/fonts/google-catalog`)
  - on-demand revalidation, even when another service (web-admin, rest-api) calls it, because only this app can clear its own cache; authenticate it with a shared secret or service token
  - Next-only work: generated files like `llms.txt`
- **A server action is a public POST endpoint.** Anyone can call it with any arguments. Every action checks auth itself as its first step, and validates input with Zod. Never rely on the button being hidden.
  - web-streamwizard: `getAuthContext()` / `tryAuthContext()` (`src/lib/auth.ts`).
  - web-admin: `assertAdmin()` (`src/lib/assert-admin.ts`), or the section wrappers `requireCmsAdmin()` (`lib/cms/action.ts`) and `requireDiscordAdmin()` (`lib/discord/action.ts`).
  - web-overlay (no user session): `resolveOverlayItem(subscriberToken, itemId)` (`src/lib/overlay-item-auth.ts`). The owner and config come from that lookup, never from arguments.
- **Don't wrap a route handler in a server action, call our own API from a server action, or import a server action into a route handler.** Both call the same server-only helper (`src/server/`, `src/lib/`) or `@repo/supabase/queries/*` function.
- **Backend services** (rest-api, ws-server, bots) are not Next.js apps. Calls between services stay HTTP with service tokens.

### Dashboard (`apps/web-streamwizard`)

- Route groups: `(public)`, `(auth)`, `(protected)` dashboard, `(harness)` (docs screenshot routes; `notFound()` in production or unless `DOCS_SHOTS=1`), and `api`. `src/proxy.ts` plus the `(protected)` layout gate signed-in routes.
- **Mutations are server actions in `src/actions/`**, following one pattern:
  1. `getAuthContext()` (throws) or `tryAuthContext()` (returns `null`) from `src/lib/auth.ts` gives `{ supabase, user, broadcasterId }`.
  2. Validate input with Zod (schemas in `src/schemas/`).
  3. Call a `@repo/supabase/queries/*` function.
  4. Return a plain `{ data, error }` or `{ success, error }`. Do not throw to the client.
- Broadcaster ids come from `resolveBroadcasterId` (Twitch identity data). Never trust `user_metadata`, which the user can edit.
- Pages and layouts are server components; editors, modals and forms are `"use client"`.

### Admin (`apps/web-admin`)

Separate, access-controlled ops console with its own proxy, actions and API routes. Keep admin-only privileges out of streamer-facing apps.

- `src/proxy.ts` denies every page to anyone who isn't a strong-session admin, but lets `/api/*` through. **Every route handler starts with `const { session } = await getAdminSession(); if (!session) return 401`**; only `/api/health` and `/auth/callback` are open.
- Route handlers here are SWR polling endpoints for the dashboards (`/api/metrics/*`, `/api/backups*`, `/api/nav-counts`) and uploads (`/api/discord/banner-upload`). Mutations are server actions in `src/actions/`.

### Overlay playback (`apps/web-overlay`)

`src/app/[overlayId]/page.tsx` renders the OBS browser source. Scenes (`overlay_scenes`) and items (`overlay_items`) load server-side via `supabaseAdmin` and query modules. Clip video plays straight from Twitch's CDN; the server only fetches the URL.

### Page metadata (every new page)

Every new `page.tsx` exports metadata: `export const metadata: Metadata` for static pages, `generateMetadata()` for dynamic ones (`params` is a Promise in Next 16; await it). Copy follows `docs/tone_of_voice.md`.

- **When `generateMetadata` and the page need the same record, load it once:** call one loader wrapped in React `cache()` (or an `unstable_cache` loader for public content) from both. Never call an uncached query or Helix helper twice per request.

**Public pages** (web-streamwizard `(public)`):

> A public page must rank in Google **and** be quotable by AI search (ChatGPT, Perplexity, Google AI Overviews). Beyond the metadata below: one `<h1>`, clear headings, alt text on images, links to related pages, and the page's main answer in plain words near the top. Facts AI tools can lift as-is (what it does, who it's for, what it costs) beat marketing lines. Add an FAQ with `faqPageSchema` where people have real questions, and list the page in `lib/llms.ts` (the `/llms.txt` index).

- **`title`: the page name only.** The root layout template adds ` – StreamWizard`; don't repeat the brand.
- **`description`:** one or two plain sentences, about 150 characters, saying what the page gives the streamer.
- **`alternates: { canonical: absoluteUrl("/path") }`** from `@/lib/seo`.
- **Never set your own `openGraph` or `twitter` block.** It replaces the root one and drops the segment's `opengraph-image.tsx`. Next copies the page's title and description into the share cards by itself. For a custom share image, add an `opengraph-image.tsx` in that route segment built with `renderOgImage()` from `@/lib/og-image` (title lines mirror the page's `<h1>`, subline is the first sentence of its description), plus a `twitter-image.tsx` that re-exports it: `export { default, alt, size, contentType } from "./opengraph-image";`
- **Structured data** through `<JsonLd schema={...} />` (`@/components/seo/json-ld`) with the builders in `@/lib/seo` (`breadcrumbSchema`, `faqPageSchema`, `softwareApplicationSchema`, ...). Don't write JSON-LD by hand.
- **Add the path to `PUBLIC_ROUTES` in `lib/seo.ts`.** That allowlist feeds the sitemap and `/llms.txt`; a page not on it is not in the sitemap. Bump its `lastModified` when the page copy changes.
- **Pages that must stay out of search** (roadmap, goodbye, error pages): `robots: { index: false }` and leave them off `PUBLIC_ROUTES`.
- **Dynamic pages** (blog, guides): build title, description and canonical from the record in `generateMetadata`, and call `notFound()` for an unknown slug. They are *not* in `PUBLIC_ROUTES`: `app/sitemap.ts` adds `/blog`, `/guides` and every published post from `listSitemapEntries()`. Filtered index views (`?q=`, `?tag=` ...) get `robots: { index: false, follow: true }`. To list `/blog` or `/guides` in `/llms.txt`, extend the `llms.test.ts` allowlist with the CMS index paths rather than adding them to `PUBLIC_ROUTES`.

**Signed-in and auth pages** (dashboard, deck, settings, obs-viewer, auth callbacks):

- **`title` only**, so the browser tab says where you are. No description, canonical or JSON-LD, and never in `PUBLIC_ROUTES`.
- **Exception: `/login`** is meant to rank for "streamwizard login": it keeps a description and `alternates: { canonical: absoluteUrl("/login") }` (which folds `?next=` variants), and stays off `DISALLOWED_PATHS` and off `PUBLIC_ROUTES`.
- Dead-end auth pages (`/unauthorized`, `/auth/auth-code-error`) add `robots: { index: false, follow: false }`.
- A new top-level signed-in path (not under `/dashboard`) goes in `DISALLOWED_PATHS` in `lib/seo.ts` so `robots.txt` blocks it.

**web-admin and web-overlay:** `title` only, the page name without the brand (web-overlay's root layout adds ` · StreamWizard Overlay` through its `title.template`). Both root layouts already set `robots: { index: false }`; don't override or repeat it.

**Current state:** 26 of 45 web-streamwizard pages export metadata; only 5 of the 20 signed-in pages do. Add a `title` when you touch one of the others.

### Components (all web apps)

Every component lives in `src/components/`, grouped by feature. `src/app/` only holds Next.js route files. Based on [bulletproof-react](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) (feature folders, one-way imports, no barrels), adapted so all UI sits in one place.

```
src/
  app/                 routes only: page, layout, loading, error, not-found, route, metadata files
  components/
    <feature>/         everything for one feature: clips/, overlays/, vods/, users/, backups/ ...
      <sub-area>/      optional, for big features (overlays/inspector-fields/)
    shared/            cross-feature pieces: date picker, page tabs, time-range selector
    layout/            app shell: site header, sidebar, nav, dashboard frame
  providers/           React context providers
  hooks/               shared hooks at the root; hooks/<feature>/ for one feature's hooks (overlays/, obs/, deck/, widgets/)
  lib/                 helpers shared by several features
  stores/              client state stores (zustand)
  schemas/             Zod schemas for actions and forms
  types/               exported types by domain
  server/              server-only integrations (Twitch EventSub, Discord); import "server-only", never "use server"
  actions/             server actions (see Dashboard above)
```

Rules:

- **No components in `src/app/`.** A page imports from `@/components/...` and only composes them. No `_components/` or other private folders.
- **No loose files at the `components/` root.** Every file belongs to a feature, `shared/` or `layout/`.
- **Features don't import other features.** Imports flow one way: `@repo/ui`, then `shared/` and `layout/`, then `<feature>/`, then `app/`. If two features need the same component, move it to `shared/`. The page is where features meet.
- **Generic primitives** (button, dialog, card, inputs) live in `@repo/ui`, not in an app. `shared/` is for StreamWizard-specific pieces used by more than one feature.
- **Don't make it shared until it repeats.** A component starts in its feature and moves to `shared/` when a second feature needs it.
- **No barrel `index.ts` files.** Import the file directly (`@/components/vods/timeline/timeline-track`). Barrels pull whole folders into server-component bundles.
- **Feature-only hooks** go in `src/hooks/<feature>/`; shared ones at the `src/hooks/` root. Feature-only helpers may sit in the feature folder; once a second feature uses them, they move to `src/lib/`.
- **File names are kebab-case, one exported component per file.** Small private helper components in the same file are fine.
- **Server components by default.** Put `"use client"` on the smallest component that needs state, effects or browser APIs, not on whole pages or folders.

**Current state:** web-streamwizard and web-admin are already mostly grouped by feature, but don't follow the import rule yet: 47 cross-feature imports in web-streamwizard and 162 in web-admin. `shared/` and `layout/` don't exist yet in any web app. In web-streamwizard, cross-feature pieces sit in type folders (`ui/`, `buttons/`, `cards/`, `modals/`, `forms/`, `search-bars/`, `global/`, `brand/`, `seo/`), the dashboard shell is spread over `nav/`, `dashboard-frame.tsx` and `site-header.tsx`, and the public site shell lives in `public/layout/`; web-admin's shared pieces sit in `components/widgets/`. Loose files still sit at the `components/` root of both apps. web-streamwizard has 4 barrel `index.ts` files, 4 components named `index.tsx` in PascalCase folders under `components/stream/` (plus 10 PascalCase files), and about ten route files in `app/` that define components (including `(harness)/shots/shot-bridge.tsx`). New cross-feature components go in `shared/`, a new shell piece goes in `layout/`, and nothing new goes into the type folders. Fix the rest when you touch the files.

## Overlay widgets

Container/renderer split:

```
packages/ui           → types, Zod config schema, pure renderer (no data fetching)
apps/web-streamwizard → editor settings panel + registry entry
apps/web-overlay      → data container (only if the widget needs live/private data)
```

Adding a widget:

1. `packages/ui/src/components/overlay/widgets/<name>/`: `*WidgetRenderer.tsx` and `*-widget-definition.ts`. Add the config schema to `src/overlay-schemas.ts` and export from `src/overlay-exports.ts`.
2. `apps/web-streamwizard`: settings panel plus an entry in `src/components/overlays/registry/overlay-widget-registry.tsx`.
3. `apps/web-overlay`: if data is needed, a container in `src/components/widgets/` (like `clips-widget/`) registered in `OVERLAY_WIDGETS`. The list is defined twice today, in `src/app/[overlayId]/page.tsx` and in `src/components/gps-overlay-canvas.tsx` (GPS overlays); add the widget to both until they share one list. Static widgets need nothing here.
4. Twitch-backed data goes in `@repo/twitch-assets`; per-user widget state in `@repo/user-state`.

The editor scales the whole scene. Renderers use `zoom` only for hit-testing and handles, never for their own scale transform.
