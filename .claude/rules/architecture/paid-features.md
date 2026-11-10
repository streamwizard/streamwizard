---
paths:
  - "apps/web-streamwizard/src/**"
  - "apps/web-admin/src/**"
  - "apps/rest-api/src/**"
  - "packages/supabase/src/queries/subscriptions/subscriptions.ts"
---

# Paid features and access

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md).

Access to features is driven by products and plans (`products`, plans and subscriptions in the database, admin grants in web-admin). Code asks "may this user use product X?", never "what is this user paying?".

## Products today

| Product id | Gates | Page gate | Action / service checks |
|-----------|-------|-----------|-------------------------|
| `cloud_obs` | Cloud OBS instances, the deck, the auto switcher, IRL ingest keys | `requireProductAccess("cloud_obs")` on `/dashboard/irl/obs`, `/dashboard/irl/ingest`, `/deck` | `getCloudObsAccess()` / `canCreateIngestKeys()` in actions; in rest-api, `getUserActiveSubscriptionId()` behind `/users/:userId/cloud-obs-access`, `isActiveSubscriptionOfUser()` on instance create, and the `/instances/unentitled` sweep |
| `ingest_server` | nothing yet (seeded, unused) | | |

- **Don't scatter product id literals.** New code takes the id from one exported constant (add it to `@repo/supabase/queries/subscriptions/subscriptions` with its first new use) instead of typing `"cloud_obs"` again.
- **The admin grants screen reads products and plans from the DB**, so a new product only needs a migration. Code that must react to a plan change (stopping containers on revoke) goes in `apps/web-admin/src/actions/users/subscriptions.ts`.

## Rules

- **Every feature that belongs to a product checks access on the server before doing the work.** Use the helper for the place you're in:
  - **web-streamwizard pages:** `requireProductAccess(productId)` (`src/lib/require-product-access.ts`). It redirects to `/dashboard/upgrade` when there is no access, and otherwise returns the `ProductAccess` (`canAccess`, `canInteract`, `status`, `plan`).
  - **web-streamwizard server actions:** the product's helper on `getProductAccess()` (`getCloudObsAccess()` in `src/lib/obs/cloud-obs-access.ts`, `canCreateIngestKeys()` in `src/lib/obs/ingest-access.ts`), and return `{ data: null, error }` when it says no. Never call `requireProductAccess()` in an action: it redirects instead of returning an error.
  - **rest-api and other service-role code (no user session):** `getUserActiveSubscriptionId()`, `isActiveSubscriptionOfUser()` or `usersWithActiveSubscription()` from `@repo/supabase/queries/subscriptions/subscriptions`.
  - Hiding a button is not a check.
- **The UI shows why.** No access: the page's `requireProductAccess()` sends the user to `/dashboard/upgrade?feature=<product>`. Read-only access (`past_due`, `canAccess` without `canInteract`): the page renders, shows `FeatureDisabledBanner` (`src/components/shared/feature-disabled-banner.tsx`) and passes `canInteract` down so start and create controls are disabled. Server actions return a short `error` sentence, never a raw error.
- **Check at every entry point.** If a feature can be reached from a server action, an API route and a node (Cloud OBS), each one checks. OBS nodes ask rest-api (`/users/:userId/cloud-obs-access`) before each start rather than trusting the browser.
- **Starting vs stopping:** `canInteract` (active, trialing, period not over) may start, create or change things. `past_due` (`canAccess` without `canInteract`) is read-only: it can still view, stop, delete and export, never start. Once a plan is cancelled or has expired there is no access at all: pages redirect to `/dashboard/upgrade`, no node token is minted for any scope, and the node's plan sweep stops running instances. Data that lives only in our DB (ingest keys) can still be listed and deleted without a plan.
- **Limits come from the plan** (instance counts, storage quota, durations), read on the server at the moment of use, never cached in the browser.
- **New product or plan:** add it in the database and the admin grants UI, not as a hard-coded user list or flag in code.
- **Staff and admin access** to a feature goes through the same check with an admin grant, not a bypass in code.
