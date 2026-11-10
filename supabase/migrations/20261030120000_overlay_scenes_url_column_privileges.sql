-- An overlay's slug and subscriber_token decide who can load it, but owners
-- held table-wide INSERT/UPDATE on overlay_scenes, so either could be set to
-- anything straight through the API. Both are now written only by the
-- dashboard's server actions (service role). authenticated keeps the columns
-- the editor changes.
--
-- On insert, subscriber_token falls back to its random default. The slug is
-- still sent by the app, so new ones must end in the 16-character random
-- suffix generateSlug() makes. Older slugs stay valid until their owner
-- resets the overlay URL.

REVOKE INSERT, UPDATE ON TABLE public.overlay_scenes FROM anon, authenticated;
GRANT INSERT (user_id, name, slug, width, height, render_mode, is_active, is_favourite) ON TABLE public.overlay_scenes TO authenticated;
GRANT UPDATE (name, width, height, is_active, is_favourite) ON TABLE public.overlay_scenes TO authenticated;

CREATE OR REPLACE FUNCTION public.overlay_scenes_check_new_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NEW.slug !~ '-[a-z0-9]{16}$' THEN
    RAISE EXCEPTION 'overlay slug must end in a 16-character random suffix'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.overlay_scenes_check_new_slug() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER overlay_scenes_check_new_slug
  BEFORE INSERT ON public.overlay_scenes
  FOR EACH ROW EXECUTE FUNCTION public.overlay_scenes_check_new_slug();
