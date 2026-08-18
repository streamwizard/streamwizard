# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Twitch streamers. People who live in Twitch chat, have hundreds of untagged clips, and are tired of tools that treat them like enterprise customers. Two confirmed segments:

- **All streamers**: clip management, overlays/widgets, stream analytics, media library.
- **IRL streamers** (streaming outdoors from a phone): Cloud OBS, SRT/SRTLA ingest, auto scene-switcher, phone deck, GPS overlays. This segment is the newest and fastest-growing pillar.

Secondary audience: developers/contributors (the project is open source and courts contributions).

## Product Purpose

StreamWizard is a toolkit for Twitch streamers: organize and search clips, build stream overlays and custom widgets, stream IRL through a cloud-hosted OBS, and understand stream analytics. Success = a streamer runs their whole stream setup (clips, overlays, IRL infrastructure) through StreamWizard instead of stitching together 4 separate tools.

## Positioning

**Open-source streamer toolkit** (user-confirmed, 2026-08-16). Free and MIT-licensed, built in public with a community on Discord and GitHub. Competitors (StreamElements, IRLToolkit, NOALBS) cannot truthfully copy the open-source + community claim. The IRL/Cloud OBS stack ("stream IRL without a backpack PC") is the sharpest technical differentiator and a headline pillar, but sits under the open-source umbrella, not above it.

Four product pillars for the public site (user-approved): **IRL Streaming · Overlays & Widgets · Clips & VODs · Community/Open Source**.

## Operating Context

- Streamers evaluate the site while planning or improving a Twitch stream; IRL streamers specifically compare against renting/building a backpack encoder rig.
- The product app lives behind Twitch OAuth at `/dashboard`; the deck at `/deck` (a PWA used one-handed on a phone mid-stream, deliberately noindexed).
- Docs live on Mintlify at docs.streamwizard.org (tabs: Documentation, Widgets, Contribute). The marketing site links there per-pillar.
- Community lives on Discord (bot with ranks, tickets, recaps) and GitHub.

## Capabilities and Constraints

Confirmed shipped (staging, Aug 2026): Cloud OBS instances (720p30/1080p30/1080p60 plans, noVNC, media file manager, per-plan OBS config), SRT/SRTLA ingest with key rotation, IRL auto scene-switcher (sensitivity presets, manual override, chat notices), phone deck PWA (scenes, chat, stream info, sensitivity), Walking Stats GPS overlays (speed/distance/location/weather, server-owned resets), overlay editor (desktop-only; snapping, scale/crop, demo mode, DB-driven templates), custom widget builder (Monaco, community library, full docs), clips widget with continuous playback, media library on R2 (100 MB free / 1 GB on Cloud OBS plans), stream analytics (hourly viewers, category stats), Discord integration (OAuth link, role connections), GDPR self-serve (export, deletion).

Hard constraints future work must respect:

- **No self-serve checkout exists.** `/dashboard/upgrade` is a static wall; subscriptions are admin-granted. Pricing page uses **real plan tiers with placeholder prices** (user-confirmed) and request-access CTAs, never a buy button.
- **Chat commands are unfinished** ("Soon" badge in app). Roadmap material only, never a feature page.
- `ingest_server` product exists in DB but gates nothing; code bundles ingest into `cloud_obs`. Do not market it separately.
- `/deck` and all `/dashboard` routes stay out of search indexes; marketing describes them with imagery instead of linking users into auth walls.
- Every new public route must be hand-added to `PUBLIC_ROUTES` in `apps/web-streamwizard/src/lib/seo.ts` or it is absent from the sitemap.
- CSP is nonce-based with no `unsafe-inline`; inline scripts/JSON-LD must use the nonce pattern (`src/components/seo/json-ld.tsx`).
- PostHog (manual pageviews via `PostHogPageView`, `/ingest` proxy, cookieless-on-reject consent) and Sentry mount from the root layout; new pages inherit both.
- Marketing copy on rebuilt pages is **placeholder-only** (`[COPY: ...]`); the user writes final copy.

## Brand Commitments

- Name: **StreamWizard**. Logo: `public/logo.png` (+ `logo-black.png`). Wordmark set in Geist.
- Fonts: Geist Sans / Geist Mono (local, variable).
- Dark theme is the default; light exists. Accent identity: Twitch-adjacent purple (`#9e7aff`, docs primary; hero gradient purple→blue→green; OG uses `#9146FF`).
- Voice: binding guidelines in `docs/tone_of_voice.md`. "A fellow streamer who built a useful tool, not a brand trying to be relatable." Direct, specific, a bit funny, never corporate. Banned words list. One emoji max. No em dashes. Gen-Z register only as easter egg.
- Free + open source (MIT) is a brand fact, stated on the site, with GitHub/Discord CTAs.
- **Design must be unique** (user-confirmed): StreamElements is a quality/product-led reference for cleanliness and feature density, not a layout to copy. No testimonials section (deleted deliberately; data absent).

## Evidence on Hand

- Real product screenshot: `public/img/landing-page/hero-dark.webp` (dashboard, 2539×1271); `public/img/landing-page/video-player.png`.
- Live docs with real content: docs.streamwizard.org (30 pages incl. IRL guides, widget API reference).
- Real plan limits in DB migrations (resolution/fps/RAM/storage per Cloud OBS tier).
- Real OSS artifacts: LICENSE (MIT), CONTRIBUTING.md, issue templates, public repo.
- **Absent, must not fabricate:** testimonials, customer counts, uptime/benchmark numbers, press, pricing amounts.

## Product Principles

1. **Streamer-to-streamer, not vendor-to-customer.** Every surface sounds like the person who built it also uses it.
2. **Show the real product.** Real screenshots and real limits beat abstract illustration; never invent proof.
3. **Free core, honest gates.** Clips/overlays/analytics are free; Cloud OBS is the paid tier and the site says so plainly, with request-access until checkout ships.
4. **Open by default.** Code, roadmap, and support happen in public (GitHub, Discord, open docs); the site routes people there constantly.
5. **IRL is the spearhead.** The cloud OBS + ingest + switcher stack is the story competitors can't tell; give it room without letting it eclipse the free toolkit.
