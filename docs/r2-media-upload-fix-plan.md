# R2 media upload fixes

Status: **plan, 2026-10-03**. Nothing built. Covers the media library upload path (`apps/web-streamwizard/src/actions/assets.ts`, `packages/storage/src/r2.ts`, `user_assets`). OBS file storage is out of scope.

## Findings (from the 2026-10-03 review)

| # | Severity | Problem |
|---|---|---|
| 1 | High | `user_assets` RLS is `FOR ALL`: a user can rewrite `key`, `size_bytes`, `status`, `mime_type` on their own rows through PostgREST. Setting `key` to another user's path and calling `deleteAsset` deletes that user's R2 object. `size_bytes = 0` skips the quota. |
| 2 | High | The presigned PUT has no size limit, and `confirmAssetUpload` records whatever `HeadObject` returns without checking it against 10 MB or the quota. |
| 2b | High (new) | The `Content-Type` is **not** signed. The S3 presigner adds `content-type` to `unsignableHeaders` (`@aws-sdk/s3-request-presigner` `prepareRequest`). So the comment in `assets.ts` is wrong: a client can PUT `text/html` with a URL minted for `image/png`. The CDN is same-site with the dashboard, so that is a stored-XSS vector. |
| 3 | Medium | Quota check and pending insert are separate steps. Parallel `createAssetUpload` calls all pass before any row exists. |
| 4 | Medium | Confirm doesn't check the stored `Content-Type` against the row's `mime_type`. |
| 5 | Medium | `reconcileAssets` has no caller: no cron, no button. |
| 6 | Medium | Account deletion cascades `user_assets` rows but leaves the R2 objects. |
| 7 | Low | `deleteAsset` deletes the R2 object before the row. A failed row delete leaves a broken entry. |
| 8 | Low | The MIME allowlist misses common aliases (`audio/x-wav`, `audio/wave`, `audio/mp3`). |
| 9 | Low | Reconcile can delete an object uploaded between `selectAllAssetKeys` and `listPrefix`. |
| 10 | Policy | Decision 2026-10-03: **100 MB storage for every user, 10 MB max per file**, paid plans included. `cloud_obs` currently gets 1024 MB via `plans.limits.storage.asset_quota_mb`, and the docs say "paid plans get more". |

## Verified while planning
- Only `20260724000000_user_assets.sql` touches `user_assets` / `user_storage_usage`. No later migration changes the RLS. There is no `supabase/schemas` dir.
- `insertUserAsset`, `markAssetReady`, `deleteUserAsset` are used only in `actions/assets.ts`.
- `createAdminClient()` from `@repo/supabase/next/admin` is already used in web-streamwizard server actions (`actions/ingest-output-keys.ts`, `dashboard/irl/ingest/page.tsx`).
- Presigner: `content-length` is not in `ALWAYS_UNSIGNABLE_HEADERS` (`@smithy/signature-v4`), so `ContentLength` on the `PutObjectCommand` gets signed. `content-type` is only signed when passed in `signableHeaders` (it overrides the unsignable list in `getCanonicalHeaders`).
- Scheduled jobs that need R2 can't run in pg_cron (no R2 credentials in Postgres). rest-api already runs in-process sweepers (`discord-live-role-sweeper`, `twitch-token-validator`, `backup-poller`, started in `apps/rest-api/src/index.ts`) and already builds an `R2Storage` (`user-authorization-revoke.ts`). Reconcile goes there.
- Other R2 writers use their own prefixes (`discord-tickets/`, the banner `PREFIX`), so a sweep limited to `assets/` is safe.

## Phase 1: security (findings 1, 2, 2b, 4, 10)

### 1. Lock down `user_assets` writes
- **Fix:** replace the `FOR ALL` policy with `FOR SELECT` only. All writes go through the server action with the admin client, scoped by `user_id` in the query.
- **Migration** `supabase/migrations/20261003120000_user_assets_rls_lockdown.sql`:
  - `DROP POLICY "Users manage own assets"`, then `CREATE POLICY "Users read own assets" ... FOR SELECT USING (auth.uid() = user_id)`.
  - `REVOKE INSERT, UPDATE, DELETE ON public.user_assets FROM anon, authenticated` (belt and braces).
- **Code:** in `actions/assets.ts`, insert / mark ready / delete use `createAdminClient()`. Reads (`selectUserAsset`, `selectReadyAssets`, usage) keep the user client. Add `.eq("user_id", userId)` to `markAssetReady` and `deleteUserAsset` in `packages/supabase/src/queries/assets.ts` so the admin calls are still owner-scoped.
- **Also:** `deleteAsset` rebuilds the expected key prefix `assets/${user.id}/${asset.id}/` and refuses if `asset.key` doesn't start with it (defends against rows rewritten before the migration lands).
- **Verify:** local PostgREST with a user JWT. `PATCH /user_assets?id=eq.X` with `{"key": "..."}` returns 0 rows / 401. Upload, confirm and delete still work in the dashboard.

### 2 + 2b. Enforce size and type at upload
- **Fix in `packages/storage/src/r2.ts`:** `presignPut(key, contentType, contentLength, expires)` sets `ContentLength` on the command and passes `signableHeaders: new Set(["content-type", "content-length"])` to `getSignedUrl`. The browser already sends both headers (XHR sets `Content-Length` from the `File`).
- **Fix in `confirmAssetUpload`:** select `size_bytes` and `mime_type` too (extend `selectUserAsset`). After `headObject`:
  - `head.size > MAX_FILE_BYTES` or `head.size !== asset.size_bytes` → delete object + row, return an error.
  - `head.contentType !== asset.mime_type` → same.
- **Fix comment** in `assets.ts` about the signed Content-Type so it matches the new code.
- **Verify:**
  - `curl -X PUT` to a minted URL with a bigger body → R2 `403 SignatureDoesNotMatch`.
  - `curl` with `Content-Type: text/html` → 403.
  - Normal browser upload works (check R2 accepts a signed `content-length`; if it doesn't, keep the confirm-side checks and drop it from `signableHeaders`).
  - Unit test for `presignPut`: URL `X-Amz-SignedHeaders` contains `content-length;content-type;host`.

### 10. Flat 100 MB quota
- **Migration** `supabase/migrations/20261003120050_flat_asset_quota.sql`: `UPDATE public.plans SET limits = limits #- '{storage,asset_quota_mb}' WHERE product_id = 'cloud_obs';`
- **Code:** none needed. `getUserAssetQuotaMb` returns null with no plan override, so `FREE_QUOTA_MB` (100) applies to everyone. Keep the override path so a paid tier can get more later with one `UPDATE`. Rename `FREE_QUOTA_MB` to `DEFAULT_QUOTA_MB` for clarity.
- **Docs:** `apps/docs/overlays/media-library.mdx:23` drop "paid plans get more" (each account gets 100MB). `/overlays` copy ("100MB of storage free") stays correct.
- **Existing users over 100 MB:** before the prod deploy, read-only check on prod: `SELECT user_id, used_bytes FROM user_storage_usage WHERE used_bytes > 104857600`. Over-quota users keep their files but can't upload until under the limit (current behaviour, no deletion).
- **Verify:** local user with an active `cloud_obs` sub shows `/ 100 MB` on the media page.

## Phase 2: correctness (findings 3, 7, 8)

### 3. Atomic quota reservation
- **Migration** `supabase/migrations/20261003120100_reserve_user_asset.sql`: `public.reserve_user_asset(p_user_id uuid, p_id uuid, p_key text, p_file_name text, p_mime text, p_size bigint, p_kind text, p_quota_bytes bigint, p_reservation_cutoff timestamptz) RETURNS boolean`, `SECURITY DEFINER`, `SET search_path = public`:
  1. `PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0))`: one reservation per user at a time.
  2. `used := ready bytes from user_storage_usage + sum(pending size_bytes where created_at >= cutoff)`.
  3. `used + p_size > p_quota_bytes` → `RETURN false`.
  4. Insert the pending row, `RETURN true`.
  - `REVOKE EXECUTE ... FROM public, anon, authenticated; GRANT EXECUTE ... TO service_role`. Quota is still worked out in TS (`getUserAssetQuotaMb`) and passed in, so plan logic stays in one place.
- **Code:** new `reserveUserAsset` in `queries/assets.ts` (admin client). `createAssetUpload` calls it instead of `getUsedBytes` + `insertUserAsset`. `false` → existing "Not enough storage left" copy.
- **Types:** hand-add the RPC to `packages/supabase/src/types/supabase.ts` (generated types lag; regen only from `--local` on purpose).
- **Verify:** script that fires 10 parallel `createAssetUpload` calls for 9 MB each against a 50 MB quota. At most 5 rows get inserted.

### 7. Delete order
- Delete the row first (admin client, owner-scoped), then the R2 object. If the R2 delete fails, `reportError` and still return success: the reconcile sweep removes the orphan.
- **Verify:** stub `deleteObject` to throw. The row is gone and the UI updates.

### 8. MIME aliases
- Add an alias map that normalises before the allowlist: `audio/x-wav`, `audio/wave`, `audio/vnd.wave` → `audio/wav`; `audio/mp3` → `audio/mpeg`; `audio/x-m4a` stays rejected. Store and sign the **original** `file.type` (that's what the browser sends), and only use the normalised value for the `kind` lookup.
- **Verify:** unit test on `kindFromMime`. Upload a `.wav` from Chrome on Windows.

## Phase 3: cleanup (findings 5, 6, 9)

### 5. Scheduled reconcile in rest-api
- Move the reconcile logic out of the server action into `apps/rest-api/src/services/asset-reconciler.ts`, using the same pattern as `discord-live-role-sweeper.ts` (`createX(deps)`, `start()`, in-flight guard, first run after 30 s, then every hour). Start it in `apps/rest-api/src/index.ts` only when R2 env is set.
- Queries move to `packages/supabase/src/queries/assets.ts` (already there: `selectStalePendingAssets`, `selectAllAssetKeys`).
- Drop the `reconcileAssets` server action (no caller), or keep it as a thin admin trigger. Recommend drop.
- **Verify:** unit test with fake R2 + fake queries (stale pending removed, orphan removed, known key kept). Run once against local R2-less env: it logs "skipped" and doesn't throw.

### 6. Account deletion
- `delete-account.ts`: before `deleteUserData`, best-effort `r2.listPrefix(\`assets/${user.id}/\`)` + delete each, inside the same try/catch style as the ticket-attachment step. Reuse the existing `R2Storage` instance (build it once for both steps).
- `user-authorization-revoke.ts` (rest-api): same prefix delete with the module-level `r2`, before the user is removed.
- The hourly sweep (5) is the backstop when either best-effort step fails: rows cascade away with `auth.users`, so the objects show up as orphans.
- **Verify:** local: upload 2 files, delete the account, `listPrefix` returns empty.

### 9. Reconcile race
- Only delete orphans whose `lastModified` is older than the presign expiry + margin (e.g. 15 minutes). A fresh upload always has a pending row by then, or it was abandoned and the next pass gets it.
- **Verify:** unit test: an orphan with `lastModified = now` is kept, one from an hour ago is removed.

## Deploy order
1. Phase 1 code + migration in one PR against `staging`. Deploy the migration first (staging DB workflow), then web-streamwizard. The code works under both the old and new policy because writes use the admin client.
2. Phase 2 PR: migration (`reserve_user_asset`) before web-streamwizard.
3. Phase 3 PR: rest-api (sweeper + revoke cleanup) and web-streamwizard (delete-account) in any order. Check R2 env on rest-api in Doppler stg + prd.
4. After phase 1 is on prod, run reconcile once to clear objects left by rows that might have been tampered with.

All migrations local first (`--local`), never pushed to remote by hand. Prod goes through `deploy-prod-db.yml`.

## Out of scope, noted
- `discord-bot/src/lib/ticket-transcript.ts` stores Discord attachments with the attachment's own `contentType` (could be `text/html`) on the same same-site CDN. Same XSS class as 2b; worth its own ticket.
- Check that the asset CDN sends `X-Content-Type-Options: nosniff` (Cloudflare transform rule). Couldn't check: the Cloudflare MCP is down this session.
