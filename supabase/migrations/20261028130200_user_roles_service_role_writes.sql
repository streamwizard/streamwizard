-- smp_admin_full_access was a FOR ALL policy on user_roles with no limit on
-- which role or user a row names. Any smp_admin could grant itself (or anyone)
-- 'admin', or remove other admins, straight through PostgREST.
--
-- Role changes go through web-admin's setAdminRoleAction (admin + strong
-- session, service role) or SQL by hand. smp_admin keeps read access only.

DROP POLICY IF EXISTS "smp_admin_full_access" ON public.user_roles;

CREATE POLICY "smp_admin_read_roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((SELECT public.check_user_role('smp_admin')));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.user_roles FROM anon, authenticated;
