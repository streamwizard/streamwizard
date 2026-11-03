---
paths:
  - "apps/web-streamwizard/src/**"
  - "apps/web-admin/src/**"
  - "apps/rest-api/src/**"
  - "packages/supabase/src/queries/subscriptions.ts"
---

# Paid features and access

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md).

Access to features is driven by products and plans (`products`, plans and subscriptions in the database, admin grants in web-admin). Code asks "may this user use product X?", never "what is this user paying?".

- **Every feature that belongs to a product checks access on the server** with `requireProductAccess()` before doing the work: in the server action, route handler or rest-api route. Hiding a button is not a check.
- **The UI shows why** with `FeatureDisabledBanner` when access is missing, instead of an empty page or a raw error.
- **Check at every entry point.** If a feature can be reached from a server action, an API route and a node (Cloud OBS), each one checks. Nodes ask rest-api (`/users/:userId/cloud-obs-access`) rather than trusting the browser.
- **Starting vs stopping:** block starting or creating something without access; always allow stopping, deleting and exporting what the user already has, even when a plan lapsed (`past_due`, cancelled).
- **Limits come from the plan** (instance counts, storage quota, durations), read on the server at the moment of use, never cached in the browser.
- **New product or plan:** add it in the database and the admin grants UI, not as a hard-coded user list or flag in code.
- **Staff and admin access** to a feature goes through the same check with an admin grant, not a bypass in code.
