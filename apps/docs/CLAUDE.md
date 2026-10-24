# Writing StreamWizard docs

Rules for `apps/docs`, the Mintlify site at docs.streamwizard.org.

Wording is governed by `docs/tone_of_voice.md` and visuals by `docs/branding.md`.
Both are authoritative and are not restated here. Read them first. This file
covers only what is specific to the docs site.

## Who reads this

Twitch streamers and their mods. They know OBS and Twitch's own settings. They
do not know APIs, terminals or JSON. Many read on a phone or a second monitor
while live, and plenty are not native English speakers.

The **Build widgets** tab is the exception: those readers write JavaScript, so
code and API terms are fair game there.

## Accuracy comes from the code, not from memory

Every setting, preset, default, range and label must be checked against what
ships before it is written down:

- Widgets: `OVERLAY_WIDGET_REGISTRY` in
  `apps/web-streamwizard/src/components/overlays/registry/overlay-widget-registry.tsx`,
  plus the widget's own `*-widget-config.ts` and settings panel.
- Preferences and settings: the form component, not the database column name.
- Anything Twitch-side: the server action that calls it.

Quote UI labels exactly as they appear, including capitalisation. If the code
says `Most alerts waiting`, do not write "max queue length".

Pages drift. When touching a page, re-check its tables against the config.
`overlays/goals.mdx` listed seven designs while the code shipped eight, and
`overlays/alerts.mdx` described four alert types while the widget shipped 23.

**Never document a control that cannot be reached.** If the handler exists but
no button renders it, that is a bug to report, not a feature to describe.

## Page shape

Every how-to page:

1. **Answer first.** One or two sentences saying what the thing is and what it
   gets the reader, naming the nouns someone would search for.
2. **Before you start.** Checkable conditions, each linked to the page that
   satisfies it. Three or four at most.
3. **Steps.** `<Steps>`, one action per step, imperative, UI labels in bold.
4. **If it doesn't work.** `<AccordionGroup>`, symptom-titled, the real failure
   modes from the code.
5. **Next steps.** `<CardGroup>` with two cards.

Reference material goes at the bottom of the page or on its own page. Do not
open with a settings table.

Titles are the task in the reader's words, sentence case:
"Add a follower goal to your stream", not "Goal widget configuration".

## Components

Use them. The site went a long time with almost none.

| Use | For |
|---|---|
| `<Steps>` | Any procedure of two or more steps |
| `<AccordionGroup>` | Troubleshooting, so it does not crowd a phone screen |
| `<CardGroup>` | Next steps |
| `<Tabs>` | Genuinely exclusive paths, like desktop OBS versus cloud OBS |
| `<Frame caption>` | Every image, always with a caption |
| `<Warning>` | Data loss, secrets, or something that breaks a live stream |
| `<Note>` | A real caveat |
| `<Tip>` | An optional improvement |

One callout per step at most. A page stuffed with warnings teaches people to
skip warnings.

## Snippets

`snippets/` holds the passages that repeat. Import and use them rather than
retyping:

- `add-overlay-to-obs.mdx` — the browser source procedure
- `overlay-url-warning.mdx` — overlay URLs are secrets
- `reconnect-twitch.mdx` — the Twitch re-auth path
- `widget-test-events.mdx` — firing test events from the editor

If you find yourself writing one of these again, import it instead.

## Secrets

Overlay URLs, stream keys, ingest keys and subscriber tokens are secrets. Any
page that tells someone to copy one carries the warning snippet, and no
screenshot ever shows one.

## Terminology

| Use | Not |
|---|---|
| StreamWizard | Stream Wizard, streamwizard, SW |
| overlay | scene, layout |
| widget | element, module, component |
| browser source | web source, browser layer |
| cloud OBS | virtual OBS, remote OBS |
| select | click on, hit, press (except keyboard keys) |
| sign in | log in, login as a verb |

Menu paths use an arrow: **Settings → Integrations**. That is the existing
house convention across the site.

## Before you open a PR

```bash
cd apps/docs && bun run check-links
```

CI runs this too, but it is faster to catch it locally. `bun run dev` serves
the site on port 3004 if you want to look at it.

Mintlify Cloud deploys the live site from `main`, path-scoped to `apps/docs`.
Project rule is that PRs target `staging`, so docs go live when `staging`
reaches `main`, not when your PR merges.
