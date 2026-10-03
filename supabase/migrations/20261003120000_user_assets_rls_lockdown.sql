-- Media library: users may only read their asset rows.
--
-- The original "Users manage own assets" policy was FOR ALL, so a signed-in
-- user could PATCH their own rows through PostgREST: rewrite `key` to another
-- user's object path (deleteAsset would then delete that object from R2), or
-- set size_bytes = 0 to slip past the storage quota. All writes now go through
-- the web-streamwizard server actions with the service-role client, scoped by
-- user_id in the query.

DROP POLICY IF EXISTS "Users manage own assets" ON public.user_assets;

CREATE POLICY "Users read own assets"
  ON public.user_assets FOR SELECT
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.user_assets FROM anon, authenticated;
