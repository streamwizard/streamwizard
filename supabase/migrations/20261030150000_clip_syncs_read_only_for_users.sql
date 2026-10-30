-- twitch_clip_syncs holds the per-user clip sync state. Users only need to read
-- their own row. Writes come from rest-api with the service role and from
-- delete_user_data (SECURITY DEFINER), neither of which goes through RLS.

DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.twitch_clip_syncs;

CREATE POLICY "twitch_clip_syncs_select_own" ON public.twitch_clip_syncs AS PERMISSIVE FOR SELECT TO authenticated
  USING ((( SELECT auth.uid()) = user_id));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.twitch_clip_syncs FROM anon, authenticated;
