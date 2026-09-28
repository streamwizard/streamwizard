-- Signs a user out everywhere, for web-admin's ban. A ban alone only stops
-- new sign-ins and token refreshes; an access token already issued keeps
-- working until it expires. Deleting the sessions ends that sooner: refresh
-- tokens go with them (FK cascade) and GoTrue rejects a JWT whose session is
-- gone. Returns how many sessions were ended. Service role only.

CREATE OR REPLACE FUNCTION public.admin_revoke_user_sessions(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

ALTER FUNCTION public.admin_revoke_user_sessions(uuid) OWNER TO "postgres";
REVOKE ALL ON FUNCTION public.admin_revoke_user_sessions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_user_sessions(uuid) TO service_role;
