# @repo/docs-shots

Captures the screenshots in `apps/docs/images/` with Playwright, against the
local stack. Not part of the Turbo pipeline: it declares no `build`, `lint` or
`check-types` script, so Turbo skips it the same way it skips `apps/docs`.

## Setup, once

```bash
bun install
bunx --bun playwright install chromium
```

## Running

Two terminals stay open:

```bash
# 1. the local stack
supabase start

# 2. the dashboard, with the harness routes enabled
cd apps/web-streamwizard
DOCS_SHOTS=1 doppler run --config dev_web_streamwizard -- bunx next dev --port 3000
```

Then:

```bash
cd packages/docs-shots

bun src/cli.ts                          # everything, dry run
bun src/cli.ts --only 'overlays/*'      # one area
bun src/cli.ts --only overlays/clock-widget --write   # promote into apps/docs/images
bun src/cli.ts --check                  # non-zero exit if anything drifted
```

A dry run writes to `.out/` and reports what changed. Only `--write` touches
`apps/docs/images/`. Diffs land in `.out/_diff/`.

`SHOTS_BASE_URL` points it at another port.

## Adding a shot

Add an entry to a file under `src/shots/` and export it from `src/shots/index.ts`.
The `id` doubles as the output path under `apps/docs/images/`.

## Things worth knowing before you debug this

- **`DOCS_SHOTS=1` is required.** Without it the harness routes 404, by design.
- **Harness routes cannot start with an underscore.** Next treats `_folder` as
  private and excludes it from routing, which is why they live at
  `src/app/(harness)/shots/` and not `__shots`.
- **Only the overlay WebSocket is faked.** Next's dev server runs HMR over its
  own socket, and swallowing that one stops the page hydrating at all.
- **`Date` is frozen with `setFixedTime`, not `install`.** `install` also stubs
  `setTimeout` and `MessageChannel`, which React's scheduler needs to hydrate.
- **Scripts go in through `addInitScript`, never `addScriptTag`.** The app's CSP
  has no `unsafe-inline`, so an injected `<script>` element is blocked.
- **The leak scanner fails a shot** that shows an email, a JWT, a Supabase key,
  a stream key, an ingest key, an overlay id or the real account name. Fix the
  fixture or add a redaction; do not disable it.

## What this cannot capture

Roughly 30% of the docs' images stay manual, and the prompts in `docs/` remain
the process for them:

- **Cloud OBS VNC previews.** No container locally, so the viewer shows a
  connection error.
- **The Twitch VOD player.** Needs network to Twitch and a VOD that has not
  expired. Crop VOD shots to exclude the player.
- **Live-mode simulators.** Dead by construction once the socket is faked.
- **IRL Pro screenshots.** A different app, on Android.
- **Emote wall and emote combo.** Need real emote images resolved through a
  channel id the local user does not have.
