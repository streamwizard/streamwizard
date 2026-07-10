-- Performance: wrap auth.<fn>() in a scalar subquery so the planner evaluates it
-- ONCE per query (initplan) instead of re-running it for every row.
-- Pure optimization -- semantics are identical. Fixes advisor 0003_auth_rls_initplan.

-- clip_folder_junction
ALTER POLICY "Users can add clips to their own folders" ON public.clip_folder_junction
  WITH CHECK ((( SELECT auth.uid()) = user_id) AND (EXISTS ( SELECT 1 FROM clips WHERE (clips.twitch_clip_id = clip_folder_junction.clip_id))) AND (EXISTS ( SELECT 1 FROM clip_folders WHERE ((clip_folders.id = clip_folder_junction.folder_id) AND (clip_folders.user_id = ( SELECT auth.uid()))))));

-- clip_folders
ALTER POLICY "Users can create their own folders" ON public.clip_folders WITH CHECK ((( SELECT auth.uid()) = user_id));
ALTER POLICY "Users can delete their own folders" ON public.clip_folders USING ((( SELECT auth.uid()) = user_id));
ALTER POLICY "Users can read their own folders"   ON public.clip_folders USING ((( SELECT auth.uid()) = user_id));
ALTER POLICY "Users can update their own folders" ON public.clip_folders USING ((( SELECT auth.uid()) = user_id));

-- clips
ALTER POLICY "Users can update own clips" ON public.clips USING ((( SELECT auth.uid()) = user_id)) WITH CHECK ((( SELECT auth.uid()) = user_id));

-- feedback
ALTER POLICY "Admins can manage all feedback" ON public.feedback
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid())) AND (users.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid())) AND (users.role = 'admin'::text)))));
ALTER POLICY "Users can view own feedback" ON public.feedback USING ((( SELECT auth.uid()) = user_id));

-- integrations
ALTER POLICY "integrations_select" ON public.integrations USING ((( SELECT auth.uid()) = user_id));
ALTER POLICY "integrations_update" ON public.integrations USING ((( SELECT auth.uid()) = user_id));

-- integrations_twitch
ALTER POLICY "integrations_select" ON public.integrations_twitch USING ((( SELECT auth.uid()) = user_id));
ALTER POLICY "integrations_update" ON public.integrations_twitch USING ((( SELECT auth.uid()) = user_id));

-- irl_collector_tokens
ALTER POLICY "Users manage own tokens" ON public.irl_collector_tokens USING ((( SELECT auth.uid()) = user_id));

-- irl_geo_track
ALTER POLICY "Users can read own geo tracks" ON public.irl_geo_track USING ((( SELECT auth.uid()) = user_id));

-- overlay_items
ALTER POLICY "Users can delete items of own scenes" ON public.overlay_items USING ((EXISTS ( SELECT 1 FROM overlay_scenes WHERE ((overlay_scenes.id = overlay_items.scene_id) AND (overlay_scenes.user_id = ( SELECT auth.uid()))))));
ALTER POLICY "Users can insert items to own scenes" ON public.overlay_items WITH CHECK ((EXISTS ( SELECT 1 FROM overlay_scenes WHERE ((overlay_scenes.id = overlay_items.scene_id) AND (overlay_scenes.user_id = ( SELECT auth.uid()))))));
ALTER POLICY "Users can update items of own scenes" ON public.overlay_items USING ((EXISTS ( SELECT 1 FROM overlay_scenes WHERE ((overlay_scenes.id = overlay_items.scene_id) AND (overlay_scenes.user_id = ( SELECT auth.uid()))))));
ALTER POLICY "Users can view items of own scenes"   ON public.overlay_items USING ((EXISTS ( SELECT 1 FROM overlay_scenes WHERE ((overlay_scenes.id = overlay_items.scene_id) AND (overlay_scenes.user_id = ( SELECT auth.uid()))))));

-- overlay_scenes
ALTER POLICY "Users can delete own scenes" ON public.overlay_scenes USING ((( SELECT auth.uid()) = user_id));
ALTER POLICY "Users can insert own scenes" ON public.overlay_scenes WITH CHECK ((( SELECT auth.uid()) = user_id));
ALTER POLICY "Users can update own scenes" ON public.overlay_scenes USING ((( SELECT auth.uid()) = user_id));
ALTER POLICY "Users can view own scenes"   ON public.overlay_scenes USING ((( SELECT auth.uid()) = user_id));

-- overlay_widget_instances
ALTER POLICY "Users manage own instances" ON public.overlay_widget_instances USING ((( SELECT auth.uid()) = user_id));

-- smp_players
ALTER POLICY "smp_players_owner" ON public.smp_players USING ((user_id = ( SELECT auth.uid()))) WITH CHECK ((user_id = ( SELECT auth.uid())));

-- stream_events
ALTER POLICY "Service role has full access to stream events" ON public.stream_events USING (((( SELECT auth.jwt()) ->> 'role'::text) = 'service_role'::text));

-- system_events
ALTER POLICY "Service role has full access to system events" ON public.system_events USING (((( SELECT auth.jwt()) ->> 'role'::text) = 'service_role'::text));

-- user_preferences
ALTER POLICY "Users can delete own preferences" ON public.user_preferences USING ((( SELECT auth.uid()) = user_id));
ALTER POLICY "Users can insert own preferences" ON public.user_preferences WITH CHECK ((( SELECT auth.uid()) = user_id));
ALTER POLICY "Users can update own preferences" ON public.user_preferences USING ((( SELECT auth.uid()) = user_id)) WITH CHECK ((( SELECT auth.uid()) = user_id));
ALTER POLICY "Users can view own preferences"   ON public.user_preferences USING ((( SELECT auth.uid()) = user_id));

-- users
ALTER POLICY "users_select" ON public.users USING ((( SELECT auth.uid()) = id));
ALTER POLICY "users_update" ON public.users USING ((( SELECT auth.uid()) = id));

-- widget_library_entries
ALTER POLICY "Users manage own entries" ON public.widget_library_entries USING ((( SELECT auth.uid()) = user_id));

-- widgets
ALTER POLICY "Users manage own widgets" ON public.widgets USING ((( SELECT auth.uid()) = user_id));
