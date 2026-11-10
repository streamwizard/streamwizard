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
  - No personal data in event properties: no emails, IPs, chat messages, Twitch usernames or stream titles. Use internal ids.
  - Person properties (`identifyUser`, browser only, after consent) are limited to the account id, Twitch id, display name and the internal-user flag. Never email, avatar or IP, even where the `UserProperties` type would allow it.
  - Browser tracking follows the cookie banner: until a visitor accepts, it stays cookieless (no persistent identifiers) and nothing is identified.
  - Server events (`trackServer` from `@repo/posthog/server`) rest on legitimate interest: keyed on the account id, `$process_person_profile: false`, only the user agent taken from the request, skipped for ids in `POSTHOG_OPT_OUT_USER_IDS`, and only sent from staging and production. Don't add properties that would turn them into a profile.
  - Session replay masks inputs and text by default; unmask only what's safe.
  - Retention follows the configured 12-month limit; don't build features that need older raw events.
- **Don't track in overlays at viewer scale.** web-overlay runs in OBS for every stream. The only overlay events are `overlay_loaded` (once per page load) and `overlay_heartbeat` (every 5 minutes), sent through `/api/telemetry` and keyed on the overlay's owner. Never one event per viewer, chat message, alert or frame; count those into the heartbeat instead.
- **No feature flags today.** PostHog flag requests are disabled in `initPostHog`. Ship behind a plan check ([paid-features.md](paid-features.md)) or an env var in the app's `env.ts`. If flags are ever needed, add a typed helper to `@repo/posthog` first, and remove each flag with its code path once it's fully rolled out.
