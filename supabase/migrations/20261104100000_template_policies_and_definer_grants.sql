-- Tighten grants on catalog tables, service-role-only tables and a handful of
-- functions (SW-500).
--
-- 1. Overlay and widget templates are catalog rows written by migrations (and
--    the service role). Users only ever read published ones, so authenticated
--    keeps SELECT and the published-only read policies; the smp_admin write
--    policies and every other privilege go.
-- 2. smp_admin's read of user_roles now needs a TOTP-verified session (aal2),
--    the same session strength web-admin and is_strong_admin() require.
-- 3. Security definer functions get search_path = '' and EXECUTE only for the
--    roles that call them.
-- 4. Service-role-only tables lose the default anon/authenticated privileges.

-- ---------------------------------------------------------------------------
-- 1. Templates: read-only for signed-in users
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS overlay_widget_templates_admin_all ON public.overlay_widget_templates;
DROP POLICY IF EXISTS overlay_templates_admin_all ON public.overlay_templates;
DROP POLICY IF EXISTS overlay_template_items_admin_all ON public.overlay_template_items;

REVOKE ALL ON TABLE
  public.overlay_widget_templates,
  public.overlay_templates,
  public.overlay_template_items
FROM anon, authenticated;

GRANT SELECT ON TABLE
  public.overlay_widget_templates,
  public.overlay_templates,
  public.overlay_template_items
TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. user_roles: smp_admin reads need aal2
-- ---------------------------------------------------------------------------
-- Same aal2 rule as is_strong_admin(), but for the smp_admin role, so the set
-- of accounts that may read stays the same. Users still read their own rows
-- through "Users read own roles"; every app lookup of other users' roles uses
-- the service role.
ALTER POLICY "smp_admin_read_roles" ON public.user_roles
  USING (
    (SELECT public.check_user_role('smp_admin'))
    AND (SELECT coalesce(auth.jwt() ->> 'aal', '') = 'aal2')
  );

-- Every user_roles policy is for authenticated; anon needs nothing here.
REVOKE ALL ON TABLE public.user_roles FROM anon;

-- ---------------------------------------------------------------------------
-- 3. Functions
-- ---------------------------------------------------------------------------
-- Product access checks: bodies are already schema-qualified. Called by
-- web-streamwizard with the user's session.
ALTER FUNCTION public.check_product_access(text) SET search_path = '';
ALTER FUNCTION public.get_product_access(text) SET search_path = '';

REVOKE ALL ON FUNCTION public.check_product_access(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_product_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_product_access(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_product_access(text) TO authenticated, service_role;

-- Library install counter: latest body from 20260804010000, now schema-
-- qualified and limited to approved entries (the install action only installs
-- approved ones). Called by web-streamwizard with the user's session.
CREATE OR REPLACE FUNCTION public.increment_widget_installs(entry_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.overlay_widget_library_entries
  SET installs = installs + 1
  WHERE id = entry_id
    AND is_approved;
$$;

REVOKE ALL ON FUNCTION public.increment_widget_installs(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_widget_installs(uuid) TO authenticated, service_role;

-- Signup helpers called only by the handle_new_user_integration trigger.
-- Bodies (20260618000000) are already schema-qualified; EXECUTE was revoked in
-- 20260618000002.
ALTER FUNCTION public.insert_integration(uuid) SET search_path = '';
ALTER FUNCTION public.insert_twitch_integration(uuid, jsonb) SET search_path = '';
ALTER FUNCTION public.insert_discord_integration(uuid, jsonb) SET search_path = '';

-- Trigger functions run as triggers only; nobody calls them directly.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_integration() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_user_asset_usage_delta() FROM PUBLIC, anon, authenticated;

-- Discord bot RPCs over service-role-only tables (section 4). The bot calls
-- them with the service role.
REVOKE ALL ON FUNCTION public.record_guild_member_join(text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_ticket_number(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_daily_activity(text, text, date, integer, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_guild_member_join(text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.next_ticket_number(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_daily_activity(text, text, date, integer, integer, integer, integer)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Service-role-only tables
-- ---------------------------------------------------------------------------
-- RLS on and no permissive policy: only the service role (rest-api, web-admin's
-- admin client, the bots and workers) reads or writes these. Remove the
-- default anon/authenticated privileges as well.
REVOKE ALL ON TABLE
  public.alert_locks,
  public.discord_activity_ignored_channels,
  public.discord_activity_settings,
  public.discord_announcements,
  public.discord_built_messages,
  public.discord_command_permissions,
  public.discord_daily_activity,
  public.discord_guild_members,
  public.discord_guild_settings,
  public.discord_live_posts,
  public.discord_live_roles,
  public.discord_ticket_categories,
  public.discord_ticket_form_fields,
  public.discord_ticket_products,
  public.discord_ticket_settings,
  public.discord_voice_sessions,
  public.ingest_nodes,
  public.obs_nodes,
  public.twitch_app_token,
  public.twitch_asset_cache
FROM anon, authenticated;
