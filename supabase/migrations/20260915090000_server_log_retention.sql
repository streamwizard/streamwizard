-- Server log retention (SW-334 follow-up). message.* platform events carry
-- message text (edits, deletes, bulk deletes). The text is removed from the
-- payload after 30 days; who, where and when stay. Posts already in the
-- Discord log channel aren't touched.

CREATE OR REPLACE FUNCTION public.purge_platform_event_message_text()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.platform_events
  SET payload = public.strip_platform_event_text(payload, ARRAY['content', 'before', 'after', 'lines'])
  WHERE event_type LIKE 'message.%'
    AND created_at < now() - interval '30 days'
    AND NOT (payload ? 'text_purged');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

ALTER FUNCTION public.purge_platform_event_message_text() OWNER TO "postgres";
REVOKE ALL ON FUNCTION public.purge_platform_event_message_text() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_platform_event_message_text() TO service_role;

-- Only rows that still carry text: the purged set would otherwise be re-read every night.
CREATE INDEX IF NOT EXISTS "platform_events_message_text_idx"
    ON "public"."platform_events" ("created_at")
    WHERE "event_type" LIKE 'message.%' AND NOT ("payload" ? 'text_purged');

CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "extensions";

SELECT cron.schedule(
    'purge-platform-event-message-text',
    '43 4 * * *',
    $$ SELECT public.purge_platform_event_message_text(); $$
);
