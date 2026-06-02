-- Self-service account erasure: removes application data for the authenticated user.
-- Call before auth.admin.deleteUser() from a trusted server action.

CREATE OR REPLACE FUNCTION public.delete_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_twitch_id text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT twitch_user_id INTO v_twitch_id
  FROM integrations_twitch
  WHERE user_id = v_user_id;

  -- Overlay / widget graph
  DELETE FROM overlay_widget_instances WHERE user_id = v_user_id;

  DELETE FROM overlay_items
  WHERE scene_id IN (SELECT id FROM overlay_scenes WHERE user_id = v_user_id);

  DELETE FROM overlay_scenes WHERE user_id = v_user_id;

  DELETE FROM widget_library_entries WHERE user_id = v_user_id;
  DELETE FROM widgets WHERE user_id = v_user_id;

  -- Clips
  DELETE FROM clip_folder_junction WHERE user_id = v_user_id;
  DELETE FROM clips WHERE user_id = v_user_id;
  DELETE FROM clip_folders WHERE user_id = v_user_id;
  DELETE FROM twitch_clip_syncs WHERE user_id = v_user_id;

  -- Integrations & preferences
  DELETE FROM integrations_twitch WHERE user_id = v_user_id;
  DELETE FROM integrations WHERE user_id = v_user_id;
  DELETE FROM user_preferences WHERE user_id = v_user_id;
  DELETE FROM user_roles WHERE user_id = v_user_id;

  -- IRL / geo
  DELETE FROM irl_geo_track WHERE user_id = v_user_id;
  DELETE FROM irl_collector_tokens WHERE user_id = v_user_id;

  -- SMP (if linked)
  DELETE FROM smp_players WHERE user_id = v_user_id;

  -- Broadcaster-scoped rows (no user_id column)
  IF v_twitch_id IS NOT NULL THEN
    DELETE FROM broadcaster_live_status WHERE broadcaster_id = v_twitch_id;
  END IF;

  -- Detach feedback (retain anonymised submissions)
  UPDATE feedback SET user_id = NULL WHERE user_id = v_user_id;

  DELETE FROM public.users WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_data() TO authenticated;
