-- Security advisor fixes (part 4): harden check_user_role.
--
-- The original check_user_role(p_user_id uuid, p_role text) let any authenticated
-- user pass an ARBITRARY user_id and learn whether that user held a given role
-- (role-membership disclosure). Replace it with a self-scoped variant that reads
-- auth.uid() internally, repoint the RLS policies to it, and lock the legacy
-- 2-arg form down to service_role only.
--
-- Note: check_user_role MUST remain SECURITY DEFINER -- it is called from the
-- user_roles RLS policy, and SECURITY INVOKER would re-trigger RLS on user_roles
-- and recurse. The remaining advisor warning on the 1-arg form is therefore
-- expected and safe: it can only reveal the caller's own roles.

-- 1. Self-scoped variant: callers can only check their own roles.
CREATE OR REPLACE FUNCTION public.check_user_role(p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = p_role
  );
$$;

-- Supabase default privileges grant EXECUTE directly to anon + authenticated on
-- new public functions, so revoke from anon (and PUBLIC) explicitly; keep authenticated.
REVOKE EXECUTE ON FUNCTION public.check_user_role(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.check_user_role(text) TO authenticated;

-- 2. Repoint all RLS policies to the self-scoped variant.
DROP POLICY "SMP admin cal doo all" ON public.smp_actions;
CREATE POLICY "SMP admin cal doo all" ON public.smp_actions
  AS PERMISSIVE FOR ALL TO public
  USING      ( ( SELECT public.check_user_role('smp_admin') ) )
  WITH CHECK ( ( SELECT public.check_user_role('smp_admin') ) );

DROP POLICY "smp admin can do all" ON public.smp_channelpoints_templates;
CREATE POLICY "smp admin can do all" ON public.smp_channelpoints_templates
  AS PERMISSIVE FOR ALL TO public
  USING      ( ( SELECT public.check_user_role('smp_admin') ) )
  WITH CHECK ( ( SELECT public.check_user_role('smp_admin') ) );

DROP POLICY "smp admin can do all" ON public.smp_triggers;
CREATE POLICY "smp admin can do all" ON public.smp_triggers
  AS PERMISSIVE FOR ALL TO public
  USING      ( ( SELECT public.check_user_role('smp_admin') ) )
  WITH CHECK ( ( SELECT public.check_user_role('smp_admin') ) );

DROP POLICY "smp_admin_full_access" ON public.user_roles;
CREATE POLICY "smp_admin_full_access" ON public.user_roles
  AS PERMISSIVE FOR ALL TO authenticated
  USING      ( ( SELECT public.check_user_role('smp_admin') ) )
  WITH CHECK ( ( SELECT public.check_user_role('smp_admin') ) );

-- 3. Lock the legacy 2-arg form down to service_role only (closes the leak).
--    Kept rather than dropped in case server-side (service_role) code relies on it.
REVOKE EXECUTE ON FUNCTION public.check_user_role(uuid, text) FROM PUBLIC, anon, authenticated;
