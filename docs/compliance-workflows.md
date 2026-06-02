# StreamWizard — GDPR compliance workflows

Internal runbook for fulfilling data subject requests, especially **Right to Erasure** (GDPR Art. 17). Target response window: **30 days** from verified request.

Identifiers you will need:

| System | Primary identifier |
|--------|-------------------|
| Supabase Auth / DB | `user.id` (UUID) |
| Twitch | `integrations_twitch.twitch_user_id` |
| PostHog | `distinct_id` = Supabase `user.id` (after login) |
| Sentry | `user.id` tag / user context on events |

---

## 1. Self-service deletion (preferred)

Users signed in to StreamWizard can delete their account at:

**Dashboard → Settings → Account → Delete my account**

Server flow (`apps/web-streamwizard/src/actions/auth/delete-account.ts`):

1. `public.delete_user_data()` — removes application rows for `auth.uid()` (SECURITY DEFINER).
2. `auth.admin.deleteUser(userId)` — removes `auth.users` via service role.
3. Redirect to `/` with session cleared.

**Apply migration** before enabling in production:

```bash
# from repo root, with Supabase CLI linked to the project
supabase db push
# or apply: packages/supabase/migrations/20260602120000_delete_user_data_function.sql
```

---

## 2. Manual erasure — Supabase

Use when the user emails `j.vanderwit@amrio.nl`, cannot access the app, or self-service fails.

### 2.1 Look up the user

```sql
-- By email (auth schema)
SELECT id, email, created_at FROM auth.users WHERE email ILIKE '%user@example.com%';

-- By Twitch login
SELECT user_id, twitch_user_id, twitch_username
FROM public.integrations_twitch
WHERE twitch_username ILIKE '%channelname%';
```

Record: `user_id` (UUID), `twitch_user_id`.

### 2.2 Delete application + auth data

**Option A — impersonate RPC (if you can sign in as service role tooling):**

Run `delete_user_data()` logic by executing the migration function while authenticated as that user is not possible from SQL editor without JWT. Prefer Option B.

**Option B — Admin API (recommended):**

```typescript
// One-off script or Supabase Edge Function with service role
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const userId = "00000000-0000-0000-0000-000000000000";

// Run equivalent deletes as delete_user_data() — or invoke RPC with a guarded admin wrapper.
await admin.rpc("delete_user_data"); // only works with user's JWT

const { error } = await admin.auth.admin.deleteUser(userId);
```

For manual SQL, mirror the statements in `packages/supabase/migrations/20260602120000_delete_user_data_function.sql`, substituting `v_user_id` with the target UUID, then:

```sql
-- After public data is gone:
-- Use Dashboard → Authentication → Users → Delete
-- or Auth Admin API deleteUser
```

### 2.3 Verify

```sql
SELECT * FROM public.integrations_twitch WHERE user_id = '<uuid>'; -- expect 0 rows
SELECT * FROM auth.users WHERE id = '<uuid>'; -- expect 0 rows
```

Backups: production backups may retain data until rotation (see Privacy Policy — purge within **3 months** of account closure).

---

## 3. PostHog — delete person & recordings

Project: **EU region** (`eu.i.posthog.com`).

1. Open **PostHog → Persons**.
2. Search by **distinct_id** = Supabase `user.id`.
   - If the user never accepted analytics cookies, a linked person may not exist.
3. Open the person profile → **Delete person** (removes events and session recordings tied to that person per PostHog retention settings).

**API (automation):**

```bash
# Requires personal API key with project access
export POSTHOG_PERSONAL_API_KEY="phx_..."
export POSTHOG_PROJECT_ID="..."

curl -X DELETE "https://eu.posthog.com/api/projects/${POSTHOG_PROJECT_ID}/persons?distinct_id=${USER_ID}" \
  -H "Authorization: Bearer ${POSTHOG_PERSONAL_API_KEY}"
```

Document the request ticket ID and deletion timestamp in your support log.

---

## 4. Sentry — scrub user-linked issues

1. **Discover** → filter: `user.id:<supabase_uuid>` or `user.email:<email>`.
2. For each issue group, use **Delete & discard** if the issue contains PII and is user-specific.
3. **Settings → Security & Privacy → Data Scrubbing** — confirm default scrubbers for IP, cookies, and authorization headers are enabled.

For high-volume erasure, use the [Sentry Data Privacy API](https://docs.sentry.io/api/replay/delete-replay/) / issue deletion endpoints with the org auth token.

Twitch ID may appear in breadcrumbs; search `twitch_user_id` if needed.

---

## 5. Request checklist (30-day SLA)

| Step | Owner | Done |
|------|-------|------|
| Verify requester identity (reply from registered email / Twitch channel ownership) | Support | ☐ |
| Record request date + 30-day deadline | Support | ☐ |
| Supabase: `delete_user_data` + `auth.admin.deleteUser` | Engineering | ☐ |
| PostHog: delete person by `distinct_id` | Engineering | ☐ |
| Sentry: delete/scrub issues for `user.id` | Engineering | ☐ |
| Confirm no active Twitch EventSub subscriptions (re-auth would fail; optional cleanup via Twitch API) | Engineering | ☐ |
| Email user confirmation (erasure completed) | Support | ☐ |

---

## 6. Twitch token security (reference)

- OAuth scopes: `apps/web-streamwizard/src/lib/constant.ts` (`TWITCH_SCOPES`).
- Tokens encrypted at rest with **AES-256-GCM** before storage in `integrations_twitch` (`packages/supabase/src/crypto.ts`, callback `auth/callback/twitch/route.ts`).
- Requires `TOKEN_ENCRYPTION_KEY` (64-char hex) in deployment secrets.

---

## 7. Related documents

- Public Privacy Policy: `/privacy-policy`
- Public Terms of Service: `/terms-of-service`
- Legal imprint: bottom of both pages (`components/legal/legal-notice.tsx`)
