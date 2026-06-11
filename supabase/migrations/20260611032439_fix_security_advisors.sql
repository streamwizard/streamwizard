-- Security advisor fixes (part 1):
--  * Pin search_path on all flagged functions (0011_function_search_path_mutable)
--  * Add RLS policies to tables that had RLS enabled but no policies (0008)

-- =============================================
-- 1. Fix mutable search_path on all affected functions
-- =============================================

ALTER FUNCTION public.increment_widget_installs(uuid) SET search_path = 'public';
ALTER FUNCTION public.get_clips_by_folder(text) SET search_path = 'public';
ALTER FUNCTION public.insert_twitch_integration(uuid, jsonb, uuid) SET search_path = 'public';
ALTER FUNCTION public.remove_clip_from_folder(uuid, uuid) SET search_path = 'public';
ALTER FUNCTION public.update_updated_at_column() SET search_path = 'public';
ALTER FUNCTION public.sync_all_default_commands() SET search_path = 'public';
ALTER FUNCTION public.get_user_twitch_ids() SET search_path = 'public';
ALTER FUNCTION public.create_default_commands_for_channel() SET search_path = 'public';
ALTER FUNCTION public.insert_discord_integration(uuid, jsonb, uuid) SET search_path = 'public';
ALTER FUNCTION public.update_overlay_updated_at() SET search_path = 'public';
ALTER FUNCTION public.sync_default_commands_for_channels(text) SET search_path = 'public';
ALTER FUNCTION public.check_user_role(uuid, text) SET search_path = 'public';
ALTER FUNCTION public.user_owns_channel(text) SET search_path = 'public';
ALTER FUNCTION public.get_stream_data(text) SET search_path = 'public';
ALTER FUNCTION public.create_workflow_trigger() SET search_path = 'public';
ALTER FUNCTION public.add_clip_to_folder(uuid, uuid) SET search_path = 'public';
ALTER FUNCTION public.insert_integration(uuid, public.provider_type) SET search_path = 'public';
ALTER FUNCTION public.handle_new_user_integration() SET search_path = 'public';
ALTER FUNCTION public.delete_user_data(text) SET search_path = 'public';
ALTER FUNCTION public.get_all_clips_with_folders() SET search_path = 'public';
ALTER FUNCTION public.handle_new_user() SET search_path = 'public';

-- =============================================
-- 2. RLS policies for tables that had RLS enabled but no policies
-- =============================================

-- smp_players: user-owned rows
CREATE POLICY "smp_players_owner" ON public.smp_players
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- custom_commands: no user_id column -- treat as a read-only reference table
CREATE POLICY "custom_commands_authenticated_read" ON public.custom_commands
  FOR SELECT TO authenticated
  USING (true);

-- twitch_app_token: server-side encrypted app token -- no client access
CREATE POLICY "twitch_app_token_no_client_access" ON public.twitch_app_token
  AS RESTRICTIVE
  USING (false);
