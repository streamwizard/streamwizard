-- overlay_widget_instances rows only had to carry the caller's own user_id.
-- Nothing tied overlay_item_id to an item the caller owns, and nothing kept
-- one row per item, so any signed-in user could attach a row to another
-- streamer's custom-widget item. The overlay's state API then read or wrote
-- whichever row came back, breaking or taking over that item's widget state.
--
-- 1. Remove rows whose user does not own the item's scene.
-- 2. Keep one row per item: the most recently updated one.
-- 3. UNIQUE (overlay_item_id).
-- 4. The policy checks that the item's scene belongs to the caller on every
--    write, not just that user_id is theirs.

DELETE FROM public.overlay_widget_instances owi
USING public.overlay_items oi, public.overlay_scenes s
WHERE oi.id = owi.overlay_item_id
  AND s.id = oi.scene_id
  AND owi.user_id <> s.user_id;

DELETE FROM public.overlay_widget_instances owi
USING public.overlay_widget_instances newer
WHERE newer.overlay_item_id = owi.overlay_item_id
  AND newer.id <> owi.id
  AND (newer.updated_at, newer.id) > (owi.updated_at, owi.id);

ALTER TABLE public.overlay_widget_instances
  ADD CONSTRAINT overlay_widget_instances_overlay_item_id_key UNIQUE (overlay_item_id);
-- The unique constraint's index covers lookups by item.
DROP INDEX IF EXISTS public.idx_overlay_widget_instances_overlay_item_id;

DROP POLICY IF EXISTS "Users manage own instances" ON public.overlay_widget_instances;
CREATE POLICY "Users manage own instances" ON public.overlay_widget_instances
  AS PERMISSIVE FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.overlay_items oi
      JOIN public.overlay_scenes s ON s.id = oi.scene_id
      WHERE oi.id = overlay_item_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

REVOKE ALL ON TABLE public.overlay_widget_instances FROM anon;
