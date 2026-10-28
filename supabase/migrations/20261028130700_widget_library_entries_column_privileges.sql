-- Owners held table-wide INSERT/UPDATE on overlay_widget_library_entries, and
-- the policies only checked user_id. So a user could publish with
-- is_approved = true (skipping admin moderation) and set their own likes and
-- installs to rank first in the library.
--
-- authenticated now only gets the content columns. is_approved, likes and
-- installs are written by web-admin (service role) and
-- increment_widget_installs (SECURITY DEFINER). Editing an approved entry's
-- public content sends it back to moderation. insertLibraryEntry no longer
-- sends is_approved in the same change; the column default is false.

REVOKE INSERT, UPDATE ON TABLE public.overlay_widget_library_entries FROM anon, authenticated;
GRANT INSERT (widget_id, user_id, title, description, tags) ON TABLE public.overlay_widget_library_entries TO authenticated;
GRANT UPDATE (title, description, tags) ON TABLE public.overlay_widget_library_entries TO authenticated;

CREATE OR REPLACE FUNCTION public.overlay_widget_library_entries_reset_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND (NEW.title, NEW.description, NEW.tags) IS DISTINCT FROM (OLD.title, OLD.description, OLD.tags) THEN
    NEW.is_approved := false;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.overlay_widget_library_entries_reset_approval() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER overlay_widget_library_entries_reset_approval
  BEFORE UPDATE ON public.overlay_widget_library_entries
  FOR EACH ROW EXECUTE FUNCTION public.overlay_widget_library_entries_reset_approval();
