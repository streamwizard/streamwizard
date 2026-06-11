-- Security advisor fixes (part 3): switch functions to SECURITY INVOKER where the
-- underlying tables already have proper RLS policies for authenticated users.
-- This removes the 0028/0029 SECURITY DEFINER advisory warnings entirely, since the
-- functions now run with the caller's privileges (RLS applies) instead of the owner's.

ALTER FUNCTION public.get_user_twitch_ids() SECURITY INVOKER;
ALTER FUNCTION public.jwt_broadcaster_id() SECURITY INVOKER;
ALTER FUNCTION public.add_clip_to_folder(uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.remove_clip_from_folder(uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.user_owns_channel(text) SECURITY INVOKER;
ALTER FUNCTION public.get_stream_data(text) SECURITY INVOKER;
