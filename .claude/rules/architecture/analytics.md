---
paths:
  - "packages/posthog/**"
  - "apps/web-streamwizard/src/**"
  - "apps/web-admin/src/**"
  - "apps/web-overlay/src/**"
  - "**/*posthog*"
  - "**/*analytics*"
  - "**/*track*"
---

# Product analytics (PostHog)

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md).

- **All analytics go through `@repo/posthog`.** No direct `posthog-js` / `posthog-node` calls in apps, and no second analytics tool.
- **Every event is declared in the event map** in `packages/posthog` (name and properties) before it's used, so names stay consistent and typed.
- **Names:** `snake_case`, `<object>_<past-tense verb>` (`overlay_created`, `clip_downloaded`, `obs_instance_started`). Properties are `snake_case` too.
- **Track outcomes on the server** where possible (in the server action or service, after the work succeeded), not button clicks in the browser. Client events are for things only the browser knows (page views, UI interactions that never reach the server).
- **Privacy (GDPR):**
  - No personal data in events or properties: no emails, IPs, chat messages, Twitch usernames or stream titles. Use internal ids.
  - Respect the cookie consent: until a visitor accepts, tracking stays cookieless (no persistent identifiers).
  - Session replay masks inputs and text by default; unmask only what's safe.
  - Retention follows the configured 12-month limit; don't build features that need older raw events.
- **Don't track in overlays at viewer scale.** web-overlay runs in OBS for every stream; track the streamer's actions, never one event per viewer or per frame.
- **Feature flags** come from PostHog through `@repo/posthog`; remove a flag and its code path once it's fully rolled out.
