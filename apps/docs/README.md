# @repo/docs

The public documentation site for StreamWizard, served at
[docs.streamwizard.org](https://docs.streamwizard.org). Built with
[Mintlify](https://mintlify.com).

## What it does

- User-facing docs for streamers — getting started, clips, overlays, chat, analytics.
- Written in StreamWizard's voice (see `docs/tone_of_voice.md` at the repo root).

## How it's wired

- `docs.json` — site config: theme, brand colors, logo, navigation.
- `*.mdx` — documentation pages.
- `logo/`, `favicon.png` — brand assets (copied from `web-streamwizard`).

This package is **not** part of the Docker/CI build pipeline. It has no
`build`/`lint`/`check-types` scripts, so Turborepo skips it. Mintlify cloud
builds and hosts the site, auto-deploying on every push to `main` via the
Mintlify GitHub app (configured to watch the `apps/docs` directory).

## Running locally

```bash
bun run dev --filter=@repo/docs
# or from this directory:
bun run dev
```

Opens a local preview at http://localhost:3004.

Check for broken links before pushing:

```bash
bun run check-links
```

## Deployment

Hosting is Mintlify cloud (not self-hosted Docker like the other apps):

1. Mintlify GitHub app watches `apps/docs` on the `main` branch.
2. Custom domain `docs.streamwizard.org` is set in Mintlify settings, pointed
   via a CNAME record at the DNS provider.
