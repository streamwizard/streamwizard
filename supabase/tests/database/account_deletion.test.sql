-- delete_user_data removes one account's rows, keeps clips other users filed
-- (SW-107, 20261025120000) and leaves every other account alone.
-- admin_revoke_user_sessions signs one user out everywhere (20261004121000).
-- Both are service role only.
-- Run: supabase test db --local
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(22);

-- A is deleted; B keeps a clip of A's in B's own folder.
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('50900000-0000-4000-8000-000000000aa1', 'sw509-del-a@test.local', '{"provider":"twitch"}',
   '{"provider_id":"9509001001","nickname":"sw509_del_a"}'),
  ('50900000-0000-4000-8000-000000000bb1', 'sw509-del-b@test.local', '{"provider":"twitch"}',
   '{"provider_id":"9509001002","nickname":"sw509_del_b"}');
INSERT INTO public.user_roles (user_id, role) VALUES ('50900000-0000-4000-8000-000000000aa1', 'smp_admin');
INSERT INTO public.clip_folders (id, user_id, name, href) VALUES
  ('50900000-0000-4000-8000-000000000aa2', '50900000-0000-4000-8000-000000000aa1', 'A folder', 'a'),
  ('50900000-0000-4000-8000-000000000bb2', '50900000-0000-4000-8000-000000000bb1', 'B folder', 'b');
INSERT INTO public.clips (twitch_clip_id, title, creator_name, url, broadcaster_name, created_at_twitch, user_id, broadcaster_id, creator_id) VALUES
  ('sw509-del-private', 'Private', 'a', 'https://clips.test/p', 'a', now(), '50900000-0000-4000-8000-000000000aa1', '9509001001', '9509001001'),
  ('sw509-del-shared', 'Shared', 'a', 'https://clips.test/s', 'a', now(), '50900000-0000-4000-8000-000000000aa1', '9509001001', '9509001001'),
  ('sw509-del-b', 'B clip', 'b', 'https://clips.test/b', 'b', now(), '50900000-0000-4000-8000-000000000bb1', '9509001002', '9509001002');
INSERT INTO public.clip_folder_junction (clip_id, user_id, folder_id) VALUES
  ('sw509-del-private', '50900000-0000-4000-8000-000000000aa1', '50900000-0000-4000-8000-000000000aa2'),
  ('sw509-del-shared', '50900000-0000-4000-8000-000000000aa1', '50900000-0000-4000-8000-000000000aa2'),
  ('sw509-del-shared', '50900000-0000-4000-8000-000000000bb1', '50900000-0000-4000-8000-000000000bb2');
INSERT INTO public.overlay_scenes (user_id, name, slug) VALUES
  ('50900000-0000-4000-8000-000000000aa1', 'A scene', 'sw509-del-a-aaaaaaaaaaaaaaaa'),
  ('50900000-0000-4000-8000-000000000bb1', 'B scene', 'sw509-del-b-bbbbbbbbbbbbbbbb');
INSERT INTO public.user_states (user_id, key, value) VALUES
  ('50900000-0000-4000-8000-000000000aa1', 'deaths', '1'),
  ('50900000-0000-4000-8000-000000000bb1', 'deaths', '2');
INSERT INTO public.smp_waitlist_entries
  (user_id, minecraft_username, minecraft_uuid, average_viewers, stream_language, stream_frequency) VALUES
  ('50900000-0000-4000-8000-000000000aa1', 'sw509_del_a', '50900000-0000-4000-8000-000000000aa7', 5, 'en', 'weekly');
INSERT INTO auth.sessions (id, user_id) VALUES
  ('50900000-0000-4000-8000-000000000aa9', '50900000-0000-4000-8000-000000000aa1'),
  ('50900000-0000-4000-8000-000000000aa8', '50900000-0000-4000-8000-000000000aa1'),
  ('50900000-0000-4000-8000-000000000bb9', '50900000-0000-4000-8000-000000000bb1');

-- Grants -----------------------------------------------------------------------
SELECT ok(NOT has_function_privilege('anon', 'public.delete_user_data(text, text, uuid)', 'EXECUTE'), 'anon cannot delete accounts');
SELECT ok(NOT has_function_privilege('authenticated', 'public.delete_user_data(text, text, uuid)', 'EXECUTE'), 'authenticated cannot delete accounts');
SELECT ok(NOT has_function_privilege('authenticated', 'public.admin_revoke_user_sessions(uuid)', 'EXECUTE'), 'authenticated cannot revoke sessions');
SELECT ok(has_function_privilege('service_role', 'public.delete_user_data(text, text, uuid)', 'EXECUTE'), 'the service role deletes accounts');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-000000000bb1","role":"authenticated","aal":"aal2"}';
SELECT throws_ok($$SELECT public.delete_user_data('9509001001')$$, '42501', NULL, 'a signed-in user cannot delete another account');
SELECT throws_ok($$SELECT public.admin_revoke_user_sessions('50900000-0000-4000-8000-000000000aa1')$$, '42501', NULL, 'a signed-in user cannot sign others out');
RESET ROLE;

-- Session revoke -----------------------------------------------------------------
SET LOCAL ROLE service_role;
SELECT is(public.admin_revoke_user_sessions('50900000-0000-4000-8000-000000000aa1'), 2, 'revoking ends every session of that user');
RESET ROLE;
SELECT results_eq($$SELECT user_id FROM auth.sessions WHERE id::text LIKE '50900000-%'$$,
  ARRAY['50900000-0000-4000-8000-000000000bb1'::uuid], 'other users stay signed in');

-- Account deletion -------------------------------------------------------------
SET LOCAL ROLE service_role;
SELECT is(public.delete_user_data('9509000000999', 'requested', NULL), NULL, 'an unknown Twitch id deletes nothing');
SELECT is(public.delete_user_data('9509001001', 'admin', '50900000-0000-4000-8000-000000000bb1'),
  '50900000-0000-4000-8000-000000000aa1'::uuid, 'the deleted account''s id is returned');
RESET ROLE;

SELECT is_empty($$SELECT 1 FROM public.users WHERE id = '50900000-0000-4000-8000-000000000aa1'$$, 'the users row is gone');
SELECT is_empty($$SELECT 1 FROM public.integrations_twitch WHERE twitch_user_id = '9509001001'$$, 'the Twitch link is gone');
SELECT is_empty($$SELECT 1 FROM public.user_roles WHERE user_id = '50900000-0000-4000-8000-000000000aa1'$$, 'the roles are gone');
SELECT is_empty($$SELECT 1 FROM public.clips WHERE twitch_clip_id = 'sw509-del-private'$$, 'a clip only the user filed is gone');
SELECT results_eq($$SELECT user_id IS NULL FROM public.clips WHERE twitch_clip_id = 'sw509-del-shared'$$,
  ARRAY[true], 'a clip another user filed stays, detached from the deleted account');
SELECT results_eq($$SELECT user_id FROM public.clip_folder_junction WHERE clip_id = 'sw509-del-shared'$$,
  ARRAY['50900000-0000-4000-8000-000000000bb1'::uuid], 'the other user''s folder entry stays');
SELECT is_empty($$SELECT 1 FROM public.overlay_scenes WHERE user_id = '50900000-0000-4000-8000-000000000aa1'$$, 'overlay scenes are gone');
SELECT is_empty($$SELECT 1 FROM public.user_states WHERE user_id = '50900000-0000-4000-8000-000000000aa1'$$, 'user state is gone');
SELECT is_empty($$SELECT 1 FROM public.smp_waitlist_entries WHERE user_id = '50900000-0000-4000-8000-000000000aa1'$$, 'the SMP waitlist entry is gone');
SELECT results_eq(
  $$SELECT (SELECT count(*) FROM public.overlay_scenes WHERE user_id = '50900000-0000-4000-8000-000000000bb1')::int
         + (SELECT count(*) FROM public.user_states WHERE user_id = '50900000-0000-4000-8000-000000000bb1')::int
         + (SELECT count(*) FROM public.clips WHERE twitch_clip_id = 'sw509-del-b')::int
         + (SELECT count(*) FROM public.clip_folders WHERE user_id = '50900000-0000-4000-8000-000000000bb1')::int$$,
  ARRAY[4], 'the other account keeps everything');
SELECT results_eq(
  $$SELECT payload->>'reason', actor_user_id::text FROM public.platform_events
    WHERE event_type = 'user.deleted' AND subject_user_id = '50900000-0000-4000-8000-000000000aa1'$$,
  $$VALUES ('admin', '50900000-0000-4000-8000-000000000bb1')$$, 'the deletion is logged with its reason and actor');
SELECT is_empty(
  $$SELECT 1 FROM public.platform_events WHERE event_type = 'admin.role_revoked' AND subject_user_id = '50900000-0000-4000-8000-000000000aa1'$$,
  'roles removed with the account do not log a revoke');

SELECT * FROM finish();
ROLLBACK;
