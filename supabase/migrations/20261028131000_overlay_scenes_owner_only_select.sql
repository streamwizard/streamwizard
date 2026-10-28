-- overlay_scenes holds subscriber_token, a bearer secret that lets its holder
-- join or publish to the owner's ws-server room and read/write widget state.
-- The "is_active = true" branch let anon (and every signed-in user) read it
-- for every active scene through PostgREST. RLS filters rows, not columns, so
-- the branch has to go. Every public overlay read (web-overlay, the
-- /api/overlays/[slug] route, ws-server) already uses the service role.

DROP POLICY IF EXISTS "overlay_scenes_select" ON public.overlay_scenes;
CREATE POLICY "overlay_scenes_select" ON public.overlay_scenes AS PERMISSIVE FOR SELECT TO authenticated
  USING ((( SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "overlay_items_select" ON public.overlay_items;
CREATE POLICY "overlay_items_select" ON public.overlay_items AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1 FROM overlay_scenes WHERE ((overlay_scenes.id = overlay_items.scene_id) AND (overlay_scenes.user_id = ( SELECT auth.uid()))))));

REVOKE ALL ON TABLE public.overlay_scenes FROM anon;
REVOKE ALL ON TABLE public.overlay_items FROM anon;
