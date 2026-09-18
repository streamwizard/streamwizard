-- emit_twitch_token_refresh_failed: serialise per user.
--
-- The 6-hour dedupe was a plain EXISTS check. Two refresh failures for the
-- same user in flight at once (a burst of 401s from one expired token, split
-- across rest-api and the bot) both pass the check before either inserts, and
-- the log channel gets two "token dead" posts. A transaction-level advisory
-- lock keyed on the user makes the second call wait for the first commit and
-- then see its row.
CREATE OR REPLACE FUNCTION public.emit_twitch_token_refresh_failed(
  p_twitch_user_id text,
  p_error text,
  p_status integer DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.integrations_twitch WHERE twitch_user_id = p_twitch_user_id;
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Held until the transaction ends. Namespaced so it can't collide with
  -- other advisory locks that hash a user id.
  PERFORM pg_advisory_xact_lock(hashtext('twitch.token_refresh_failed'), hashtext(v_user_id::text));

  IF EXISTS (
    SELECT 1 FROM public.platform_events
    WHERE event_type = 'twitch.token_refresh_failed'
      AND subject_user_id = v_user_id
      AND created_at > now() - interval '6 hours'
  ) THEN
    RETURN NULL;
  END IF;

  RETURN public.emit_platform_event(
    'twitch.token_refresh_failed', v_user_id, NULL,
    public.platform_event_identity(v_user_id)
      || jsonb_strip_nulls(jsonb_build_object('error', left(p_error, 500), 'status', p_status))
  );
END;
$$;
