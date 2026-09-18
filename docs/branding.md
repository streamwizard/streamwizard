# StreamWizard Branding

The visual counterpart to `docs/tone_of_voice.md`. That file owns wording. This one owns everything else: the name, the mark, color, type, imagery, motion, and how the brand behaves on surfaces we do not control.

Internal reference, so it is dense on purpose. Every value here says where it lives in code. If you change one, change both.

---

## 1. Brand foundation

### What StreamWizard is

Open source Twitch tooling for streamers, built by one streamer in the Netherlands since 2024, developed in public under MIT. Cloud OBS is the paid tier. Everything else is free.

Five pillars, one page each:

| Pillar | Route | What it does |
|---|---|---|
| Cloud OBS | `/cloud-obs` | OBS running in the cloud, aimed at IRL |
| Overlays | `/overlays` | Browser source widgets streamers configure and drop into OBS |
| Clips | `/clips` | Clip library, folders, search |
| VOD clipping | `/vods` | Cutting clips out of past broadcasts |
| Analytics | `/analytics` | Stream stats a streamer can act on |

Site title and description live in `apps/web-streamwizard/src/app/layout.tsx`:

- Title: `StreamWizard: Cloud OBS, Clips, and Analytics for Twitch`
- Description: `Cloud OBS for IRL streaming, overlays, clip management, and stream analytics for Twitch streamers. Open source and built in public.`
- Title template: `%s – StreamWizard` (en dash, not a hyphen, not an em dash)

### Who it is for

Streamers. Not agencies, not enterprises, not "content creators" in the abstract. Someone with a Twitch channel, a pile of untagged clips, and no budget for four separate subscriptions.

### Values that show up visually

**Built in public.** The roadmap is a page, not a secret. The repo is the product. Screenshots show real data because there is nothing to hide behind.

**Free by default.** Nothing about the design should read as a trial funnel. No blurred paywalled screenshots, no fake urgency, no "upgrade" interruptions in the imagery.

**The streamer's channel comes first.** Overlays carry no StreamWizard branding. The product is invisible on stream, which is a deliberate brand decision and not an oversight.

**One person made this.** The design can be sharp without pretending to be a company. No stock photos of teams, no logo wall, no "trusted by" section built out of nothing.

### Personality on screen

Near-neutral, dark, quiet. The interface is deliberately desaturated so that overlay previews and stream footage are the only saturated things on screen. Color is used to point, not to decorate.

Tone doc puts it as "a fellow streamer who built a useful tool, not a brand trying to be relatable." Visually that means confident spacing and real screenshots, not gradients on everything.

---

## 2. Name and verbal identity

### The name

**StreamWizard.** One word. Capital S, capital W.

Wrong: Stream Wizard, Streamwizard, StreamWizzard, SW as a standalone brand name in user-facing copy.

Lowercase only where the medium forces it: domains (`streamwizard.org`), package names (`web-streamwizard`), handles (`@streamwizard`), repo paths. Never lowercase in prose.

### Product names

Pillars are lowercase common nouns in prose, not trademarks: "clip folders", "the overlay editor", "cloud OBS". Capitalize only at the start of a sentence or in nav labels and headings.

"Cloud OBS" keeps OBS uppercase because OBS is someone else's product name.

### Mechanics

- Title separator is the en dash from the metadata template: `Pricing – StreamWizard`.
- No em dashes anywhere in copy. Tone doc bans them because they read as machine-written.
- Sentence case for headings, buttons, and nav. No Title Case Marketing Headers.
- One emoji maximum per message, and never as an interface icon.

Everything about wording, humor, error copy, and empty states lives in `docs/tone_of_voice.md`. That file wins any conflict about words.

---

## 3. Logo

### The mark

Primary mark is a single-color silhouette at `apps/web-streamwizard/public/logo.png`.

Render it with the `StreamWizardLogo` component at `apps/web-streamwizard/src/components/brand/streamwizard-logo.tsx`, never with a raw `<img>`. The component applies the PNG as a CSS mask over `bg-current`, so the mark inherits `currentColor`. That is the whole reason one file works on every background: change the text color, the logo follows.

Defaults: 160x160, `role="img"`, `aria-label="StreamWizard"`, class `bg-current text-sidebar-foreground`.

```tsx
<StreamWizardLogo width={32} height={32} className="text-foreground" />
```

Use `logo-black.png` only where a mask cannot be applied and the background is guaranteed light.

### Asset inventory

| Asset | Path | Use |
|---|---|---|
| Mask source | `apps/web-streamwizard/public/logo.png` | Every in-app render, through the component |
| Fixed dark mark | `apps/web-streamwizard/public/logo-black.png` | Dark-on-light where masking is not possible |
| Overlay app logo | `apps/web-overlay/public/logo.png` | Overlay app shell |
| Docs logo, light | `apps/docs/logo/light.png` | Mintlify light theme |
| Docs logo, dark | `apps/docs/logo/dark.png` | Mintlify dark theme |
| Docs favicon | `apps/docs/favicon.png` | Mintlify tab icon |
| App icons | `apps/{web-streamwizard,web-overlay,web-admin}/src/app/favicon.ico`, `icon.png`, `apple-icon.png` | Next.js metadata icons, one set per app |
| Deck PWA icons | `apps/web-streamwizard/public/deck-icon-{192,512}.png` | Deck home screen icon |
| Deck maskable icons | `apps/web-streamwizard/public/deck-icon-maskable-{192,512}.png` | Android adaptive icon |

Maskable icons get cropped to a circle or squircle by the OS. Keep all meaningful content inside the center 80% safe zone, and let the padding be background.

**TODO: there is no vector master.** Everything above is PNG, exported from a source nobody has committed. Producing an SVG master is open question 1 in governance.

### Clear space and minimum size

Clear space: at least 25% of the mark's height on all four sides. Nothing sits inside that box, including text set next to the mark in a lockup.

Minimum size: 24px square on screen. Below that the silhouette stops resolving and a favicon or icon asset should be used instead.

### Never

- Never recolor the mark by editing the PNG. Change `currentColor` instead.
- Never put the mark on a gradient or a busy photograph where the silhouette loses its edge.
- Never stretch, skew, rotate, or add effects (drop shadow, glow, outline, bevel).
- Never redraw or "clean up" the shape.
- Never set the wordmark in a typeface and call it the logo. StreamWizard has no locked wordmark.
- Never put the mark on a streamer's overlay. See section 8.

### Co-branding

When StreamWizard appears next to another mark (Twitch, OBS, a partner), separate them with a hairline divider at `--border` and give each mark equal optical height, not equal pixel height. StreamWizard never appears first purely to claim precedence: order follows whatever the surface's own convention is.

---

## 4. Color

All tokens live in `apps/web-streamwizard/src/app/globals.css` unless stated otherwise.

### Brand accents

| Name | Value | Where it lives | Use |
|---|---|---|---|
| Twitch purple | `#9146FF` | `TWITCH_PURPLE` in `apps/web-streamwizard/src/lib/og-image.tsx`, `0x9146ff` in `apps/discord-bot/src/lib/branding.ts` | Borrowed authority, on someone else's surface |
| Wizard purple | `#9e7aff` | `--color-three` in globals.css, `primary` in `apps/docs/docs.json`, widget accent default | StreamWizard's own purple, inside the product |
| Gradient amber | `#ffbd7a` | `--color-one` | Atmosphere only |
| Gradient pink | `#fe8bbb` | `--color-two` | Atmosphere only |
| VOD amber | `#fbbf24` | `VOD_AMBER` in `og-image.tsx` | VOD pillar accent |
| Discord blurple | `#5865F2` | `DISCORD_BLURPLE` in `apps/discord-bot/src/lib/branding.ts` | Discord-native utilities only: commands and the server log |
| Danger red | `#E7000B` | `DANGER_RED` in `apps/discord-bot/src/lib/branding.ts` | Destructive log events (account deleted, plan revoked, Discord unlinked, member left, kicked, banned or timed out, message, role or channel deleted). The light `--destructive` token as hex |

### The two-purple rule

There are two purples and the split is deliberate.

**Twitch purple `#9146FF` is borrowed authority.** Use it where StreamWizard is sitting inside a surface it does not own and needs to read as Twitch-adjacent: the default social card accent, and every StreamWizard-authored Discord embed. It says "this is about your Twitch channel".

**Wizard purple `#9e7aff` is ours.** Use it inside the product and the docs, where the surface is already StreamWizard's: `--color-three`, the docs primary (light `#b89dff`, dark `#7c5cff`), the overlay widget accent default. It says "this is StreamWizard talking".

Do not swap them to fix a contrast problem. If a purple fails on a background, change the background or use a foreground token.

Discord has a third rule on top: purple means StreamWizard is talking, blurple means it is a Discord utility. Welcome, stats, rank, leaderboard, and recap are Discord-native and take blurple. Anything reporting on a Twitch stream takes Twitch purple.

### Gradient set

`--color-one` amber, `--color-two` pink, `--color-three` purple, used together as heavily transparent radial glows behind the hero, the final CTA, and the roadmap spine.

Atmosphere only. Never a surface color, never a button fill, never text. If a gradient is doing work that a border or a background step could do, remove it.

### Light theme tokens

Light is fully supported and gets a hairline ring plus a soft shadow for elevation instead of a background step. That stack is defined once in the `@layer base` block in globals.css. Do not re-invent it per component.

| Token | Value |
|---|---|
| `--background` | `#eef0f4` |
| `--foreground` | `oklch(0.24 0.02 260)` |
| `--card`, `--popover`, `--input` | `oklch(1 0 0)` |
| `--muted-foreground` | `oklch(0.46 0.025 260)` |
| `--border` | `oklch(0.88 0.014 260)` |
| `--destructive` | `oklch(0.577 0.245 27.325)` |
| `--sidebar` | `#eef0f4` |
| `--sidebar-accent` | `#e4e7ed` |
| `--sidebar-border` | `#d5dae3` |

### Dark theme tokens

Dark is the default and gets designed first. If a screen only works in light, it is not finished.

| Token | Value |
|---|---|
| `--background` | `oklch(0.145 0 0)` |
| `--foreground` | `oklch(0.985 0 0)` |
| `--card`, `--popover` | `oklch(0.205 0 0)` |
| `--muted-foreground` | `oklch(0.708 0 0)` |
| `--border` | `oklch(1 0 0 / 10%)` |
| `--destructive` | `oklch(0.704 0.191 22.216)` |

### Chart colors

`--chart-1` through `--chart-5` are defined per theme. Use them in order. Never pick a chart color by hand, and never use a brand accent for a data series: the accent has a job already, and a purple series next to a purple button reads as related when it is not.

More than five series means the chart needs rethinking, not a sixth color.

### Social card colors

Fixed, in `apps/web-streamwizard/src/lib/og-image.tsx`:

| Role | Value |
|---|---|
| Background | `#0a0a0a` |
| Title | `#fafafa` |
| Eyebrow and subline | `#a1a1aa` |
| Accent | pillar accent, default `TWITCH_PURPLE` |

Card background is `#0a0a0a`, not `--background`. Cards render outside the theme system and need a value that does not move.

### Usage rules

- The interface stays near-neutral. Overlay previews and stream footage should be the only saturated things on screen.
- `#9e7aff` fails WCAG AA for small text on white. It is for accents, large display type, and text on dark backgrounds only.
- Semantic meaning beats brand: destructive is `--destructive`, never a brand accent tinted red.
- A pillar accent identifies a pillar. Do not reuse VOD amber for a warning state or purple for a link color outside the accent rules.

---

## 5. Typography

### Typefaces

| Face | Variable | Source | Applied to |
|---|---|---|---|
| Geist Sans | `--font-geist-sans` | `next/font/local`, `src/app/fonts/GeistVF.woff` (variable, 100 to 900) | `body`, everything by default |
| Geist Mono | `--font-geist-mono` | `next/font/local`, `src/app/fonts/GeistMonoVF.woff` | `code, pre, kbd, samp` |
| Geist static cuts | none | `Geist-Regular.ttf`, `Geist-SemiBold.ttf` | Social cards only |
| Inter | per widget | Google Fonts, at render time in the overlay | Overlay widget default |

**Do not delete the static TTFs.** `Geist-Regular.ttf` and `Geist-SemiBold.ttf` exist only because Satori cannot parse a variable font and crashes on it when generating social cards. They look redundant next to `GeistVF.woff`. They are not. This is written down here so nobody tidies the fonts directory and breaks every OG image.

Fonts are self-hosted for the app. There is no Google Fonts link in the app shell, and adding one is a regression.

Overlay widgets are the exception: they default to Inter via `DEFAULT_GOOGLE_FONT_FAMILY` in `packages/ui/src/components/overlay/types/base.ts`, and streamers can pick any Google font per widget. That is their choice on their channel, not a brand decision.

### Scale

Tailwind's default type scale, unmodified. If a size is missing, the layout is wrong before the scale is.

### Rules

- Negative tracking on display type. Social cards use `letter-spacing: -3` at 82px and 68px.
- Positive tracking on small uppercase eyebrows: `0.03em` on sidebar group labels, `0.1em` on the hero logo cloud.
- Live-updating numbers use `tabular-nums`: timers, clocks, speed, viewer counts, any stat that ticks. Without it the layout jitters on every update.
- Mono is for code, keys, and IDs. Not for "technical looking" body copy.

---

## 6. Imagery and graphics

### Screenshots are the product photography

There is no stock photography. Ever. Screenshots carry the visual weight instead, so they get treated like photography.

- Dark theme, unless the shot is specifically about light theme.
- Real data. Never lorem ipsum, never `Test Clip 1`, never placeholder avatars.
- Never show a real viewer name, a Twitch email, a stream key, an OAuth token, or a session ID. Redact by substituting a plausible fake value, not by painting a black box over it. A black box says "here is the interesting part".
- Crop to the thing being explained. A full-window screenshot to illustrate one button wastes the reader's attention.

Framing decisions already made are encoded in `docs/mintlify-irl-screenshot-prompt.md`, `docs/mintlify-switcher-monitor-screenshot-prompt.md`, `docs/mintlify-walking-stats-screenshot-prompt.md`, and `docs/discord-docs-screenshot-prompt.md`. Read the relevant one before shooting a new set.

### Demo footage

IRL and cloud OBS demo footage is xpudu's streams (`twitch.tv/xpudu`, `xpuduChannelLink` in `apps/web-streamwizard/src/lib/constant.ts`), credited on screen. Not stock video, not AI-generated b-roll. Real footage from a real streamer who agreed to it.

### Icons

Lucide, via `lucide-react`. Do not mix icon sets: a second set is visible immediately at small sizes because the stroke weights disagree.

No emoji as interface icons. Emoji are punctuation in copy, at most one per message.

### Gradients

Covered in section 4. Radial, heavily transparent, background only.

### Social cards

One layout for every public route, in `apps/web-streamwizard/src/lib/og-image.tsx`. 1200x630 PNG.

Layout, top to bottom:

1. 14px round accent dot plus a 28px eyebrow, top left
2. Two-line title, second line in the pillar accent, 82px dropping to 68px when the longer line exceeds 26 characters
3. 34px subline
4. A 180x6 fully rounded rule in the accent

Routes supply copy and an accent. They never fork the layout. One layout is the point: every share looks like it came from the same place.

**A page must not define its own `openGraph` block.** It replaces the root one and silently detaches the generated card, which then falls back to nothing. This has already happened once.

### Motion

| Motion | Timing |
|---|---|
| View transitions | 0.4s ease |
| Accordions | 0.2s ease-out |
| Shimmer | 1.8s |
| Marquee, border beam, flow dash | linear, per-instance duration |
| Light mode transition video | scripted `.webm`, flips theme at 3.8s |

Rules:

- Animate `transform` and `opacity` only. Anything else costs a layout pass.
- `prefers-reduced-motion` is honored throughout and is not optional. View transitions are killed outright in a media query in globals.css. Decorative motion uses `motion-reduce:hidden` or `motion-reduce:animate-none`.
- Motion that repeats forever must be subtle enough to sit behind reading. If it pulls the eye on the second loop, it is too strong.

---

## 7. Interface application

### Radius

`--radius: 0.625rem` (10px), in `:root` in globals.css. The scale is derived in `@theme inline`:

| Step | Value |
|---|---|
| `sm` | radius - 4px |
| `md` | radius - 2px |
| `lg` | radius |
| `xl` | radius + 4px |
| `2xl` | radius + 8px |
| `3xl` | radius + 12px |
| `4xl` | radius + 16px |

Use the steps. A hand-written `rounded-[13px]` breaks the relationship between nested corners.

### Spacing

Tailwind's default spacing scale, unmodified.

`--header-height: 3.5rem`. Anything that needs to sit below the header reads that token instead of hardcoding `56px`.

### Elevation

Dark theme separates surfaces with a background step: `--background` `oklch(0.145 0 0)` under `--card` `oklch(0.205 0 0)`.

Light theme cannot use that step without looking muddy, so it uses a hairline ring plus a soft shadow instead. Defined once, in the `@layer base` block in globals.css, on `[data-slot="card"]` and `[data-slot="sidebar-inner"]`. Do not add a per-component shadow to solve a light-mode elevation problem: fix it in that block or the two themes drift.

### Cursor

Tailwind v4's preflight sets buttons to `cursor: default`. globals.css restores the pointer for `button:not(:disabled)` and `[role="button"]:not([aria-disabled="true"])`. Anything clickable reads as clickable.

### Where tokens live

| Concern | File |
|---|---|
| Theme tokens, radius, animations, base layer | `apps/web-streamwizard/src/app/globals.css` |
| Social card colors and layout | `apps/web-streamwizard/src/lib/og-image.tsx` |
| Discord embed accent | `apps/discord-bot/src/lib/branding.ts` |
| Docs theme and logos | `apps/docs/docs.json` |
| Social and product links | `apps/web-streamwizard/src/lib/constant.ts` |
| Overlay widget defaults | `packages/ui/src/components/overlay/types/base.ts` |
| Logo component | `apps/web-streamwizard/src/components/brand/streamwizard-logo.tsx` |

---

## 8. Channels

### Domains

| Surface | URL |
|---|---|
| App | `streamwizard.org` |
| Docs | `docs.streamwizard.org` |

### Accounts

| Channel | URL |
|---|---|
| Discord | https://discord.gg/29Eq659egv |
| GitHub | https://github.com/streamwizard/streamwizard |
| Twitch | https://twitch.tv/jochemwhite |
| X | https://x.com/streamwizard |

Header and footer order is Discord, GitHub, Twitch. X appears in the docs footer only (`apps/docs/docs.json`) and is not part of the main site's social row.

Links live in `socialLinks` in `apps/web-streamwizard/src/lib/constant.ts`. Add a channel there, not inline in a component, or the header and footer drift apart.

### Discord

Two visual registers, and the split is the same one as the two purples:

- StreamWizard-authored embeds (anything reporting on a Twitch stream) use `TWITCH_PURPLE` `0x9146ff` from `apps/discord-bot/src/lib/branding.ts`.
- Discord-native utilities (welcome, stats, rank, leaderboard, recap, and server log events such as joins, bans and message deletes) use blurple `#5865F2`, `DISCORD_BLURPLE`.

Purple means StreamWizard is talking. Blurple means it is a Discord utility.

Platform log events (signups, plans, Discord links) are StreamWizard talking, so their embeds are Twitch purple. Server log events (members, messages, roles, channels) are a Discord utility and take blurple. Destructive events take `DANGER_RED` `0xe7000b` instead, because semantic meaning beats brand.

### Docs

Mintlify, `mint` theme, configured in `apps/docs/docs.json`. Primary `#9e7aff`, light `#b89dff`, dark `#7c5cff`. Logos at `/logo/light.png` and `/logo/dark.png`.

Docs follow this book for visuals and `docs/tone_of_voice.md` for wording, same as everything else.

### Overlays on stream

The highest-stakes surface, because it renders on someone else's channel to their audience.

Widget defaults: Inter, `#b9b9c6` labels, `#9e7aff` accent.

**StreamWizard never watermarks a streamer's overlay.** No logo, no "powered by", no burned-in attribution, no subtle corner mark. If a growth idea requires putting the brand on a streamer's stream, the answer is no.

Defaults must stay legible over arbitrary footage. That is what the IRL widget drop shadows are for: the streamer cannot preview every background they will walk past, so the default has to survive a white wall and a night street.

### Video

**TODO: there is no video identity.** No intro, no lower third, no end card exists. Open question 7 in governance.

### Merch

**TODO: no merch policy exists.** Nothing has been produced and no rules have been written. Third parties may not sell merch carrying the mark (section 9), but there is no decision on first-party merch.

---

## 9. Third-party and community use

MIT covers the code. It does not cover the name or the mark. Nothing in the repo says this today, which is why it is written here.

### Allowed

- Linking to StreamWizard using the name or the mark.
- Saying you use StreamWizard.
- Screenshots of StreamWizard in tutorials, reviews, and bug reports.
- Forking the repo under MIT.

### Not allowed

- Using the mark as your own avatar or product identity.
- Implying partnership, sponsorship, or endorsement.
- Merch carrying the name or mark that you sell.
- Modifying the mark and still calling it the StreamWizard logo.
- A domain or package name that reads as official (`streamwizard-pro.com`, `@streamwizard/anything` you did not publish).

### Forks

MIT lets you fork and distribute. A distributed fork must be renamed and rebranded: new name, new mark, no StreamWizard branding in the UI or the metadata. Keep the license and the attribution the license requires. Credit in a README is welcome and is not the same as branding.

---

## 10. Governance

### Owner

Jochem (`jochemwhite`). One person decides brand values, same as everything else here.

### How to change a value

1. Change it in the file section 7 names as its home.
2. Change it here in the same PR. A token in code that contradicts this book makes both useless.
3. If it is a new value with no home, give it one before shipping it. A hex code inline in a component is a value that will get copied wrong.
4. PRs go against `staging`. Never `main` or `production`.

### Open questions

- [ ] **Vector logo master.** Everything is PNG. No SVG source exists, so the mark cannot be scaled for print, cut for a sticker, or exported cleanly at a new size.
- [ ] **Locked tagline.** The hero lines rotate and nothing is locked. Decide whether a single line should be fixed, or write down that rotation is the intent.
- [ ] **Full WCAG contrast matrix.** Only one failing pair is documented (`#9e7aff` on white, small text). Both themes need a full foreground-on-background pass.
- [ ] **Illustration style.** No illustration exists and no decision has been made. Either define a style or write down that StreamWizard is screenshot-only.
- [ ] **globals.css consolidation.** The file has drifted across `web-streamwizard`, `web-overlay`, `web-admin`, and `packages/ui`. Decide on one source and have the rest import it.
- [ ] **Public `/brand` or `/press` page.** No downloadable assets exist, so anyone writing about StreamWizard grabs a screenshot of the logo.
- [ ] **Video identity.** No intro, lower third, or end card.
- [ ] **Merch policy.** Third-party merch is banned. First-party merch has no decision.

---

For anything about words, see `docs/tone_of_voice.md`.
