-- Admin rights in the database now need the same strong session as web-admin.
--
-- check_user_role('admin') only looked at user_roles, so an admin's plain
-- Twitch session (aal1, no passkey) could read and write every admin table
-- straight through PostgREST, skipping the TOTP/passkey step that web-admin
-- enforces in isStrongSession (packages/supabase/src/auth/session-strength.ts).
--
-- is_strong_admin() is the SQL twin of that check: the admin role plus either
-- aal2 (TOTP verified this session) or a passkey entry in amr. Every admin
-- policy switches to it. check_user_role itself is unchanged for its other
-- callers. web-admin writes through the service role, which skips RLS, and its
-- browser realtime subscriptions run on the admin's strong session, so neither
-- changes.

CREATE OR REPLACE FUNCTION public.is_strong_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.check_user_role('admin')
    AND (
      coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      OR coalesce(auth.jwt() -> 'amr', '[]'::jsonb) @> '[{"method": "passkey"}]'::jsonb
    );
$$;

REVOKE ALL ON FUNCTION public.is_strong_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_strong_admin() TO authenticated, service_role;

ALTER POLICY "Admins read alert events" ON public.alert_events
  USING ((SELECT public.is_strong_admin()));
ALTER POLICY "Admins read alert notification config" ON public.alert_notification_config
  USING ((SELECT public.is_strong_admin()));
ALTER POLICY "Admins read alert rule config" ON public.alert_rule_config
  USING ((SELECT public.is_strong_admin()));
ALTER POLICY "Admins read alert state" ON public.alert_state
  USING ((SELECT public.is_strong_admin()));
ALTER POLICY "Admins read backup events" ON public.backup_events
  USING ((SELECT public.is_strong_admin()));
ALTER POLICY "Admins read backup poll state" ON public.backup_poll_state
  USING ((SELECT public.is_strong_admin()));
ALTER POLICY "Admins read discord log event settings" ON public.discord_log_event_settings
  USING ((SELECT public.is_strong_admin()));
ALTER POLICY "Admins read discord settings audit" ON public.discord_settings_audit
  USING ((SELECT public.is_strong_admin()));
ALTER POLICY "Admins read discord ticket answers" ON public.discord_ticket_answers
  USING ((SELECT public.is_strong_admin()));
ALTER POLICY "Admins read discord ticket events" ON public.discord_ticket_events
  USING ((SELECT public.is_strong_admin()));
ALTER POLICY "Admins read discord ticket members" ON public.discord_ticket_members
  USING ((SELECT public.is_strong_admin()));
ALTER POLICY "Admins read discord ticket messages" ON public.discord_ticket_messages
  USING ((SELECT public.is_strong_admin()));
ALTER POLICY "Admins read discord ticket tags" ON public.discord_ticket_tags
  USING ((SELECT public.is_strong_admin()));
ALTER POLICY "Admins read discord tickets" ON public.discord_tickets
  USING ((SELECT public.is_strong_admin()));
ALTER POLICY "Admins read platform events" ON public.platform_events
  USING ((SELECT public.is_strong_admin()));
ALTER POLICY "Admins read proxmox vm alert settings" ON public.proxmox_vm_alert_settings
  USING ((SELECT public.is_strong_admin()));
ALTER POLICY "Admins manage node api keys" ON public.obs_node_api_keys
  USING ((SELECT public.is_strong_admin())) WITH CHECK ((SELECT public.is_strong_admin()));
ALTER POLICY "Admins manage ingest node api keys" ON public.ingest_node_api_keys
  USING ((SELECT public.is_strong_admin())) WITH CHECK ((SELECT public.is_strong_admin()));
ALTER POLICY "admins can manage all subscriptions" ON public.user_subscriptions
  USING ((SELECT public.is_strong_admin())) WITH CHECK ((SELECT public.is_strong_admin()));

-- Node API keys are minted and revoked by rest-api and web-admin with the
-- service role. No user JWT should write them, admin or not.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.obs_node_api_keys FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.ingest_node_api_keys FROM anon, authenticated;
