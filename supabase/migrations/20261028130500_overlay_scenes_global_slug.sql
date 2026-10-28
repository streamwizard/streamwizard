-- Overlay URLs are /<slug> with no user in them, but the slug was only unique
-- per user (overlay_scenes_user_id_slug_key). Any signed-in user could PATCH
-- their own scene to another streamer's slug, and the public lookup would then
-- pick either scene: the victim's OBS source broke or showed the attacker's
-- scene.
--
-- Slugs are now unique across all users. Existing cross-user duplicates keep
-- the slug on the oldest scene; newer ones get a suffix from their id, so a
-- streamer whose scene was copied keeps their URL.

UPDATE public.overlay_scenes s
SET slug = s.slug || '-' || substr(replace(s.id::text, '-', ''), 1, 6)
WHERE EXISTS (
  SELECT 1 FROM public.overlay_scenes o
  WHERE o.slug = s.slug
    AND o.id <> s.id
    AND (o.created_at, o.id) < (s.created_at, s.id)
);

ALTER TABLE public.overlay_scenes DROP CONSTRAINT IF EXISTS overlay_scenes_user_id_slug_key;
DROP INDEX IF EXISTS public.idx_overlay_scenes_slug;
ALTER TABLE public.overlay_scenes ADD CONSTRAINT overlay_scenes_slug_key UNIQUE (slug);
