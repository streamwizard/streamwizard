-- Passkey sign-in no longer counts as an admin's second factor (SW-483).
--
-- is_strong_admin() accepted aal2 *or* a passkey entry in amr. GoTrue lets
-- any signed-in session register a passkey (no aal check), so a stolen
-- Twitch-only admin session could register its own passkey, sign in with it
-- and pass every admin policy straight through PostgREST.
--
-- Passkeys are a Supabase beta and are switched off; admins use TOTP only.
-- TOTP is a real MFA factor: once an admin has one verified, GoTrue refuses
-- to enrol another factor unless the session is already aal2. So aal2 alone
-- is the rule, the same as web-admin's isStrongSession.

CREATE OR REPLACE FUNCTION public.is_strong_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.check_user_role('admin')
    AND coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;
