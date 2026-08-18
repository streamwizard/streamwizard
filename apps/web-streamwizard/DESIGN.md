---
name: StreamWizard Public Pages
description: The open-source Twitch toolkit's marketing surface, drawn as one live signal path on near-black ground.
colors:
  signal-purple: "#9e7aff"
  signal-blue: "#3b82f6"
  signal-green: "#4ade80"
  live-red: "oklch(0.704 0.191 22.216)"
  ground: "oklch(0.145 0 0)"
  surface: "oklch(0.205 0 0)"
  surface-hover: "oklch(0.269 0 0)"
  signal-white: "oklch(0.985 0 0)"
  action-white: "oklch(0.922 0 0)"
  meta-gray: "oklch(0.708 0 0)"
  hairline: "oklch(1 0 0 / 10%)"
typography:
  display:
    fontFamily: "Geist Sans, sans-serif"
    fontSize: "2.25rem → 3.75rem (text-4xl sm:text-5xl md:text-6xl)"
    fontWeight: 700
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Geist Sans, sans-serif"
    fontSize: "1.5rem → 2.25rem (text-2xl md:text-4xl)"
    fontWeight: 600
    letterSpacing: "-0.025em"
  lede:
    fontFamily: "Geist Sans, sans-serif"
    fontSize: "1.125rem → 1.25rem (text-lg md:text-xl)"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Geist Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
  label-mono:
    fontFamily: "Geist Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    letterSpacing: "0.1em"
    fontFeature: "tabular-nums for values; uppercase for labels"
rounded:
  md: "0.625rem"
  xl: "0.875rem"
  2xl: "1.125rem"
  full: "9999px"
spacing:
  container-pad: "1rem"
  section-quiet: "3rem"
  section-regular: "5rem"
  content-gap: "1.5rem"
  action-gap: "1rem"
components:
  button-primary:
    backgroundColor: "{colors.action-white}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: "40px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.signal-white}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 24px"
  button-outline-hover:
    backgroundColor: "{colors.surface-hover}"
  pipeline-node:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    size: "56px"
  station-nameplate:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.meta-gray}"
    rounded: "6px"
    padding: "6px 12px"
  edge-stat:
    textColor: "{colors.meta-gray}"
    typography: "{typography.label-mono}"
  live-badge:
    textColor: "{colors.live-red}"
    typography: "{typography.label-mono}"
  docs-band:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "20px 24px"
---

# Design System: StreamWizard Public Pages

> **Scope.** This document governs the **public marketing surface only** — the `(public)` route group (`/`, `/irl`, `/overlays`, `/clips`, `/pricing`, `/roadmap`) and its components under `src/components/public/`. The `(protected)` dashboard keeps its incumbent shadcn system (including the light-mode canvas/elevation work in `globals.css`) and is **out of scope** here. The marketing world extends the incumbent token set — dark-default shadcn variables, Geist fonts, `--radius: 0.625rem` — rather than replacing it.

## Overview

**Creative North Star: "The Signal Path"**

The homepage is the stream's own rig — phone → ingest → cloud OBS → Twitch — drawn as one live line, and every other page is a zoomed segment of the same line. The world is an engineer's diagram, not a brochure: near-black ground, hairline borders instead of shadows, monospace telemetry ticking on a single shared clock, and exactly one continuous motion (the dash march). The brand's purple→blue→green gradient is spent entirely on the line itself; text stays white and gray, and red appears once per page as the payoff (LIVE). It deliberately refuses the category's hero-screenshot-plus-feature-grid arrangement.

Density is calm and airy: one column of content hung off a left spine, generous vertical rhythm, and honesty as an aesthetic — every synthetic number is labeled `demo data`, and unwritten copy and uncaptured screenshots ship as visible `[COPY:]` / `[IMAGE:]` placeholders rather than invented content.

**Key Characteristics:**
- One gradient line (the signal path) carries all brand color; everything else is grayscale.
- One shared 1.2s clock synchronizes every live element: dash march, ticking stats, pulses.
- Flat, hairline-bordered surfaces on near-black ground; no shadows on the marketing surface.
- Geist Sans for prose, Geist Mono for anything machine-flavored (stats, labels, nameplates).
- Red is a single-use resource per page: the LIVE badge and nothing else.

## Colors

A grayscale world where all chroma is reserved for the signal line and its stations; hue is meaning, not decoration.

### Primary
- **Signal Purple** (`#9e7aff`): first gradient stop; source end of the path (phone/IRL). Also tints the icon of the station or spine node it belongs to (e.g. IRL, community, docs book icon).
- **Signal Blue** (`#3b82f6`): middle gradient stop; transport (ingest node, overlays, analytics node icons).
- **Signal Green** (`#4ade80`): final gradient stop; delivery end (cloud OBS, clips, pricing node icons) and the terminal dot where the spine ends.

### Secondary
- **Live Red** (destructive token, `oklch(0.704 0.191 22.216)`): the LIVE badge only. One instance per page, always at the Twitch end of a signal line.

### Neutral
- **Ground** (`oklch(0.145 0 0)`): the page background (`--background`, dark default).
- **Surface** (`oklch(0.205 0 0)`): node tiles, cards, docs bands (`--card`, often at 40–60% alpha over ground for quiet containers).
- **Surface Hover** (`oklch(0.269 0 0)`): hover fill for ghost/outline actions (`--accent`).
- **Signal White** (`oklch(0.985 0 0)`): headings and primary text (`--foreground`; stat values ride at 90% alpha).
- **Action White** (`oklch(0.922 0 0)`): the primary button fill (`--primary`); the strongest solid on the page after the line itself.
- **Meta Gray** (`oklch(0.708 0 0)`): ledes, nav links at rest, mono labels, demo tags (`--muted-foreground`).
- **Hairline** (`oklch(1 0 0 / 10%)`): every border (`--border`); structure is drawn, not cast.

### Named Rules
**The One Line Rule.** The purple→blue→green gradient exists only as the signal line (`signal-grad-x` / `signal-grad-y` utilities in `globals.css`) — horizontal in heroes, vertical as the page spine. Never as text fill, button fill, or background wash. Individual stops may tint a station's *icon* to tie it to its position on the line; that is the only other place they appear.

**The One Red Rule.** Red is the destructive token and it is spent at most once per page, only as the `LiveBadge`. If a page has no LIVE moment, it has no red.

**The Selection Rule.** Text selection is brand purple at 30% (`color-mix(in srgb, #9e7aff 30%, transparent)`), not the browser default.

## Typography

**Display/Body Font:** Geist Sans (variable, 100–900, local `GeistVF.woff`), sans-serif fallback
**Mono Font:** Geist Mono (variable, local `GeistMonoVF.woff`), monospace fallback

**Character:** Plainspoken engineering. Sans carries the argument in bold, tight-tracked headings; mono carries everything the machine would say — telemetry, protocol names, station designations — in small uppercase, wide-tracked labels.

### Hierarchy
- **Display** (700, 2.25rem → 3.75rem, tracking `-0.025em`): the one `h1` per page (home hero, segment-hero titles). Max width ~3xl (48rem).
- **Headline** (600, 1.5rem → 2.25rem, tracking `-0.025em`): spine-section titles. Quiet sections cap at 1.25–1.5rem.
- **Lede** (400, 1.125rem → 1.25rem, Meta Gray): the paragraph under a display heading, max width ~2xl (42rem).
- **Body** (400, 0.875rem, Meta Gray): docs bands, supporting copy.
- **Label** (Geist Mono, 0.75rem, uppercase, tracking 0.05–0.1em): station nameplates, stat labels, nav-adjacent metadata. The demo tag drops to 10px at `0.1em` tracking.

### Named Rules
**The Tabular Rule.** Every ticking number renders in Geist Mono with `tabular-nums` so values wander without the layout breathing.

**The No-Kicker Rule.** No eyebrow or kicker labels above headings. The mono station nameplate is not an eyebrow: it sits *on the line* beside the node as a diagram label (a real product designation like "SRT / SRTLA ingest"), never floated above an `h1` as decoration.

## Layout

One column hung off the signal line. The home hero fills the first viewport (`min-h-[calc(100svh-6rem)]`), manifesto text left-aligned above the full-width horizontal pipeline. Below it, the line turns vertical: a left spine at `1.75rem` (mobile) / `2.5rem` (desktop) from the container edge, with each pillar section attached at a solid node that masks the line behind it. Content indents past the spine (`pl-16` / `md:pl-24`).

- **Container:** centered, `padding-inline: 1rem`; screens at 640 / 768 / 1024 / 1280px.
- **Rhythm:** regular sections `py-20` (5rem), quiet sections `py-12` (3rem) with smaller headings — pacing is a first-class dial (`density` prop on `SpineSection`).
- **Responsive grammar:** the pipeline is the same DOM in two orientations — horizontal stations on a grid at `md:`, a vertical spine list below it. Segment heroes run the line full-bleed behind an enlarged node.
- **Close:** the spine converges to a centered 1px line ending in a green terminal dot, then one action. No restated feature grid.

## Elevation & Depth

Flat by doctrine on the marketing surface: **no box shadows**. Depth is conveyed by tonal layering (Surface tiles on Ground, sometimes at 40–80% alpha), hairline borders, and the two-layer line trick — every signal line is a static gradient at 30–40% opacity with a brighter dashed layer marching on top of it, so the line itself reads as lit rather than lifted. The sticky header uses `backdrop-blur-xl` over the page instead of a drop shadow. (The elaborate light-mode shadow vocabulary in `globals.css` belongs to the dashboard, not to this surface.)

### Named Rules
**The Drawn-Not-Cast Rule.** Structure is drawn with 1px hairline borders; nothing casts a shadow. If an element needs separation, give it a border or a tonal step, never a shadow.

## Shapes

Soft-rectangular tiles on a hard 1px line. Radius derives from the incumbent `--radius: 0.625rem`: buttons and nameplates at `0.375–0.625rem`, node tiles at `rounded-xl` (0.875rem), the enlarged segment-hero node at `rounded-2xl` (1.125rem), pulse dots and terminal dots fully round. Image placeholders are dashed-border tiles (`border-dashed`) — the dash marks "not yet real," rhyming with the dashed signal line. Lines are exactly 1px at rest; the marching dash layer may thicken to 2px (`h-0.5`).

## Components

### Buttons
- **Shape:** gently rounded (`0.625rem`), 40px tall (`size="lg"` for hero CTAs).
- **Primary:** the shadcn default variant — Action White fill (`oklch(0.922 0 0)`) with dark text; reserved for the one conversion action (Connect Twitch). At most one per viewport-height of content.
- **Outline:** transparent fill, hairline border, Signal White text and icon; hover fills with Surface Hover (`hover:bg-accent`, color transition only). Used for the GitHub action beside the primary.
- **Ghost:** text-only Meta Gray → Signal White on hover (nav links, mobile menu trigger).

### Pipeline Node
The system's signature tile: a `56px` square (`h-14 w-14`), `rounded-xl`, Surface fill, hairline border, holding one 24px icon tinted with that station's gradient stop. Spine nodes are 48px; segment-hero nodes enlarge to 64–80px at `rounded-2xl` with a 32–36px icon. Nodes are opaque so they mask the line passing behind them.

### Station Nameplate
Mono label chip on the line: `rounded-md`, Ground fill at 80% alpha, hairline border, `px-3 py-1.5`, uppercase mono 0.75rem wide-tracked Meta Gray. Content is always a real product designation (protocol, subsystem), never marketing copy.

### Edge Stat + DemoDataTag
Inline mono readout: uppercase label at 70% opacity, tabular value in Signal White at 90%, optional unit. Values are deterministic functions of the shared tick (`wander()` in `signal/stats.tsx`) so SSR and first client render agree. **Every cluster of synthetic numbers carries the `DemoDataTag`** (10px mono uppercase "demo data").

### LiveBadge
Mono uppercase "Live" in Live Red beside an 8px red dot with a `motion-safe` ping halo. Terminal payoff of a signal line; once per page.

### DocsBand
Standing pointer to docs.streamwizard.org closing each cluster page: Surface tile at 60% alpha, `rounded-xl`, purple book icon, body copy, and an underline-on-hover text link with arrow.

### ImageSlot
Dashed hairline tile at fixed aspect ratio (default 16/9), Surface at 40%, centered mono `[IMAGE: …]` label naming exactly what real screenshot belongs there. Never replaced by invented imagery.

### Navigation
Sticky, `backdrop-blur-xl`, hairline separator below. Wordmark + logo left; page links (in signal-path reading order: IRL, Overlays, Clips, Pricing, Roadmap) as ghost links, vertical separator, Docs/GitHub/Discord, then the Log in button. Mobile collapses to a right-side sheet.

## Do's and Don'ts

### Do:
- **Do** run every live element off the shared `SignalClockProvider` (1.2s tick) and keep CSS dash marches at exactly `1.2s linear infinite` so all motion stays in phase.
- **Do** draw new signal lines as the two-layer pair: static gradient at 30–40% opacity under a `signal-dash-*` marching layer.
- **Do** attach a `DemoDataTag` to every synthetic number cluster, and keep unwritten content as literal `[COPY: …]` / `[PRICE]` / `[IMAGE: …]` placeholders — final copy is the user's, per `docs/tone_of_voice.md`.
- **Do** freeze all motion under `prefers-reduced-motion` (the clock never starts; dashes stand still).
- **Do** register every new public route in `PUBLIC_ROUTES` in `src/lib/seo.ts`, and give cluster pages a `SegmentHero` whose station nameplate is a real product designation.
- **Do** keep section pacing deliberate: `density="quiet"` for supporting pillars, regular for headline pillars.

### Don't:
- **Don't** use the brand gradient as text fill, button fill, or background wash — it exists only as the line (The One Line Rule).
- **Don't** render red anywhere except a single `LiveBadge` per page.
- **Don't** add box shadows, kickers/eyebrows above headings, or a hero screenshot + feature-grid arrangement — the world was built to refuse them.
- **Don't** spawn independent `setInterval`s or ad-hoc animation durations for live elements; one clock, one beat.
- **Don't** carry this system into the `(protected)` dashboard, or import the dashboard's light-mode shadow vocabulary onto the marketing surface.
