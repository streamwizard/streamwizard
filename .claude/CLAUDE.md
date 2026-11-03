# StreamWizard

## Architecture
Follow the golden rules in @../ARCHITECTURE.md. The detail rules live in `.claude/rules/architecture/` and load automatically when you read or edit matching files. If you change a convention, update that rule file in the same PR.

## Pull Requests
Always open PRs against the `staging` branch. Never target `main` or `production` (prod) as the base.

## Copy & Tone of Voice
When writing any user-facing copy — marketing pages, landing pages, onboarding, buttons, empty states, errors — follow the guidelines in `docs/tone_of_voice.md`.

## Branding
For any visual or brand-facing work — logo, color tokens, typography, screenshots, motion, social cards, channels, third-party use of the mark — follow `docs/branding.md`. When you change a brand value in code (a token in `globals.css`, an accent in `og-image.tsx` or the Discord bot, the docs theme), update `docs/branding.md` in the same PR so the book and the code stay in sync.
