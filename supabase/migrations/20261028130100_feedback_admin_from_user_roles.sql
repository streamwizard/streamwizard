-- The feedback policies took admin rights from public.users.role, a column
-- every signed-in user could write on their own row (table-wide UPDATE grant,
-- owner-only policy). One PATCH of role = 'admin' gave read, edit and delete
-- over everyone's feedback.
--
-- Admin rights now come from user_roles through is_strong_admin(), like every
-- other admin policy. users.role stays for now but no client can write it:
-- no app code updates public.users with a user session, so authenticated
-- loses UPDATE on the table entirely. Rows are still written by
-- handle_new_user (SECURITY DEFINER) and the service role.

DROP POLICY IF EXISTS "feedback_select" ON public.feedback;
DROP POLICY IF EXISTS "feedback_insert" ON public.feedback;
DROP POLICY IF EXISTS "feedback_update" ON public.feedback;
DROP POLICY IF EXISTS "feedback_delete" ON public.feedback;

CREATE POLICY "feedback_select" ON public.feedback AS PERMISSIVE FOR SELECT TO authenticated
  USING ((( SELECT auth.uid()) = user_id) OR (SELECT public.is_strong_admin()));
CREATE POLICY "feedback_insert" ON public.feedback AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((( SELECT auth.uid()) = user_id) OR (SELECT public.is_strong_admin()));
CREATE POLICY "feedback_update" ON public.feedback AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((SELECT public.is_strong_admin()))
  WITH CHECK ((SELECT public.is_strong_admin()));
CREATE POLICY "feedback_delete" ON public.feedback AS PERMISSIVE FOR DELETE TO authenticated
  USING ((SELECT public.is_strong_admin()));

REVOKE UPDATE ON TABLE public.users FROM anon, authenticated;
DROP POLICY IF EXISTS "users_update" ON public.users;
