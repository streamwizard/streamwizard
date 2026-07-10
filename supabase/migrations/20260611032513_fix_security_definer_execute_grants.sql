-- Security advisor fixes (part 2): lock down EXECUTE on SECURITY DEFINER functions.
-- anon/authenticated inherit EXECUTE from PUBLIC, so the correct pattern is to
-- revoke from PUBLIC and grant back only to the roles that genuinely need it.

-- =============================================
-- Fully internal functions: revoke from PUBLIC entirely
-- (trigger helpers + delete_user_data -- never called via RPC)
-- =============================================

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_integration() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.insert_twitch_integration(uuid, jsonb, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.insert_discord_integration(uuid, jsonb, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.insert_integration(uuid, public.provider_type) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_user_data(text) FROM PUBLIC;

-- =============================================
-- User-facing functions: revoke from PUBLIC, grant back to authenticated only
-- =============================================

REVOKE EXECUTE ON FUNCTION public.add_clip_to_folder(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.add_clip_to_folder(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.remove_clip_from_folder(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.remove_clip_from_folder(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_twitch_ids() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_user_twitch_ids() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_owns_channel(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.user_owns_channel(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.jwt_broadcaster_id() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.jwt_broadcaster_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_stream_data(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_stream_data(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.check_user_role(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_user_role(uuid, text) TO authenticated;
