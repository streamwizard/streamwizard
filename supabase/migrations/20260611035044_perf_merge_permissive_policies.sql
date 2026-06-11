-- Performance: collapse duplicate PERMISSIVE policies that target the same
-- role+action (Postgres ORs every matching permissive policy per row).
-- Fixes advisor 0006_multiple_permissive_policies. Access semantics preserved:
-- broad ALL policies (admin / service_role / owner) are split into explicit
-- per-command policies and their condition folded into the per-command policy via OR.

-- ============ feedback ============
-- Was: "Admins can manage all feedback" (ALL) + per-command user policies.
DROP POLICY "Admins can manage all feedback" ON public.feedback;
DROP POLICY "Enable insert for users based on user_id" ON public.feedback;
DROP POLICY "Users can view own feedback" ON public.feedback;

CREATE POLICY "feedback_select" ON public.feedback AS PERMISSIVE FOR SELECT TO authenticated
  USING ((( SELECT auth.uid()) = user_id) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid())) AND (users.role = 'admin'::text)))));
CREATE POLICY "feedback_insert" ON public.feedback AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((( SELECT auth.uid()) = user_id) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid())) AND (users.role = 'admin'::text)))));
CREATE POLICY "feedback_update" ON public.feedback AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid())) AND (users.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid())) AND (users.role = 'admin'::text)))));
CREATE POLICY "feedback_delete" ON public.feedback AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid())) AND (users.role = 'admin'::text)))));

-- ============ overlay_items (merge two SELECT policies) ============
DROP POLICY "Public can read items of active scenes" ON public.overlay_items;
DROP POLICY "Users can view items of own scenes" ON public.overlay_items;
CREATE POLICY "overlay_items_select" ON public.overlay_items AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1 FROM overlay_scenes WHERE ((overlay_scenes.id = overlay_items.scene_id) AND ((overlay_scenes.is_active = true) OR (overlay_scenes.user_id = ( SELECT auth.uid())))))));

-- ============ overlay_scenes (merge two SELECT policies) ============
DROP POLICY "Public can read active scenes by slug" ON public.overlay_scenes;
DROP POLICY "Users can view own scenes" ON public.overlay_scenes;
CREATE POLICY "overlay_scenes_select" ON public.overlay_scenes AS PERMISSIVE FOR SELECT TO public
  USING (((is_active = true) OR (( SELECT auth.uid()) = user_id)));

-- ============ stream_events (split service-role ALL into per-command) ============
DROP POLICY "Service role has full access to stream events" ON public.stream_events;
DROP POLICY "Users can insert their own stream events" ON public.stream_events;
DROP POLICY "Users can view their own stream events" ON public.stream_events;
DROP POLICY "Users can update their own stream events" ON public.stream_events;
CREATE POLICY "stream_events_select" ON public.stream_events AS PERMISSIVE FOR SELECT TO public
  USING (((( SELECT auth.jwt()) ->> 'role'::text) = 'service_role'::text) OR user_owns_channel(broadcaster_id));
CREATE POLICY "stream_events_insert" ON public.stream_events AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((( SELECT auth.jwt()) ->> 'role'::text) = 'service_role'::text) OR user_owns_channel(broadcaster_id));
CREATE POLICY "stream_events_update" ON public.stream_events AS PERMISSIVE FOR UPDATE TO public
  USING (((( SELECT auth.jwt()) ->> 'role'::text) = 'service_role'::text) OR user_owns_channel(broadcaster_id));
CREATE POLICY "stream_events_delete" ON public.stream_events AS PERMISSIVE FOR DELETE TO public
  USING (((( SELECT auth.jwt()) ->> 'role'::text) = 'service_role'::text));

-- ============ system_events (split service-role ALL into per-command) ============
DROP POLICY "Service role has full access to system events" ON public.system_events;
DROP POLICY "Users can view system events for their channels" ON public.system_events;
CREATE POLICY "system_events_select" ON public.system_events AS PERMISSIVE FOR SELECT TO public
  USING (((( SELECT auth.jwt()) ->> 'role'::text) = 'service_role'::text) OR ((broadcaster_id IS NOT NULL) AND user_owns_channel(broadcaster_id)));
CREATE POLICY "system_events_insert" ON public.system_events AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((( SELECT auth.jwt()) ->> 'role'::text) = 'service_role'::text));
CREATE POLICY "system_events_update" ON public.system_events AS PERMISSIVE FOR UPDATE TO public
  USING (((( SELECT auth.jwt()) ->> 'role'::text) = 'service_role'::text));
CREATE POLICY "system_events_delete" ON public.system_events AS PERMISSIVE FOR DELETE TO public
  USING (((( SELECT auth.jwt()) ->> 'role'::text) = 'service_role'::text));

-- ============ twitch_clip_syncs (drop redundant SELECT policy) ============
-- The ALL policy "Enable delete for users based on user_id" already grants SELECT
-- with an identical condition, so the separate SELECT policy is pure duplication.
DROP POLICY "Enable users to view their own data only" ON public.twitch_clip_syncs;

-- ============ widget_library_entries (split owner ALL into per-command) ============
DROP POLICY "Users manage own entries" ON public.widget_library_entries;
DROP POLICY "Public read approved entries" ON public.widget_library_entries;
CREATE POLICY "widget_library_entries_select" ON public.widget_library_entries AS PERMISSIVE FOR SELECT TO public
  USING (((is_approved = true) OR (( SELECT auth.uid()) = user_id)));
CREATE POLICY "widget_library_entries_insert" ON public.widget_library_entries AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((( SELECT auth.uid()) = user_id));
CREATE POLICY "widget_library_entries_update" ON public.widget_library_entries AS PERMISSIVE FOR UPDATE TO public
  USING ((( SELECT auth.uid()) = user_id));
CREATE POLICY "widget_library_entries_delete" ON public.widget_library_entries AS PERMISSIVE FOR DELETE TO public
  USING ((( SELECT auth.uid()) = user_id));
