-- smp_waitlist_entries: a user reads their own application and nothing else.
-- Every write is the service role's (the web app's server action), so the
-- status, the Minecraft UUID and the Twitch snapshot never come from a user
-- request (20261113120000).
-- Run: supabase test db --local
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(16);

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('53300000-0000-4000-8000-0000000005a1', 'smp-waitlist-a@test.local', '{"provider":"email"}', '{}'),
  ('53300000-0000-4000-8000-0000000005b1', 'smp-waitlist-b@test.local', '{"provider":"email"}', '{}'),
  ('53300000-0000-4000-8000-0000000005c1', 'smp-waitlist-c@test.local', '{"provider":"email"}', '{}');
INSERT INTO public.smp_waitlist_entries
  (user_id, minecraft_username, minecraft_uuid, average_viewers, stream_language, stream_frequency) VALUES
  ('53300000-0000-4000-8000-0000000005a1', 'Player_A', '53300000-0000-4000-8000-00000000a001', 12, 'en', 'weekly'),
  ('53300000-0000-4000-8000-0000000005b1', 'Player_B', '53300000-0000-4000-8000-00000000b001', 40, 'nl', 'most_days');

-- Owner ------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"53300000-0000-4000-8000-0000000005a1","role":"authenticated","aal":"aal1"}';

SELECT results_eq('SELECT minecraft_username, status FROM public.smp_waitlist_entries',
  $$VALUES ('Player_A', 'pending')$$, 'the owner reads their own application, and only that one');
SELECT throws_ok(
  $$INSERT INTO public.smp_waitlist_entries (user_id, minecraft_username, minecraft_uuid, average_viewers, stream_language, stream_frequency)
    VALUES ('53300000-0000-4000-8000-0000000005a1', 'Player_A2', '53300000-0000-4000-8000-00000000a002', 1, 'en', 'weekly')$$,
  '42501', NULL, 'the owner cannot insert an application directly');
SELECT throws_ok($$UPDATE public.smp_waitlist_entries SET status = 'accepted'$$,
  '42501', NULL, 'the owner cannot accept their own application');
SELECT throws_ok($$UPDATE public.smp_waitlist_entries SET minecraft_uuid = '53300000-0000-4000-8000-00000000a009'$$,
  '42501', NULL, 'the owner cannot swap in another Minecraft account directly');
SELECT throws_ok($$UPDATE public.smp_waitlist_entries SET twitch_follower_count = 999999$$,
  '42501', NULL, 'the owner cannot edit the Twitch snapshot');
SELECT throws_ok($$DELETE FROM public.smp_waitlist_entries$$,
  '42501', NULL, 'the owner cannot delete the row directly');

-- A signed-in user with no application ------------------------------------------
SET LOCAL "request.jwt.claims" TO '{"sub":"53300000-0000-4000-8000-0000000005c1","role":"authenticated","aal":"aal1"}';

SELECT is_empty('SELECT 1 FROM public.smp_waitlist_entries', 'another user reads nobody else''s application');
SELECT throws_ok(
  $$INSERT INTO public.smp_waitlist_entries (user_id, status, minecraft_username, minecraft_uuid, average_viewers, stream_language, stream_frequency)
    VALUES ('53300000-0000-4000-8000-0000000005c1', 'accepted', 'Player_C', '53300000-0000-4000-8000-00000000c001', 1, 'en', 'weekly')$$,
  '42501', NULL, 'a user cannot create a pre-accepted application');
RESET ROLE;

-- Visitors ---------------------------------------------------------------------
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" TO '{"role":"anon"}';
SELECT throws_ok('SELECT 1 FROM public.smp_waitlist_entries', '42501', NULL, 'a visitor reads nothing');
RESET ROLE;

-- Service role (the server action) -----------------------------------------------
SET LOCAL ROLE service_role;
SELECT lives_ok(
  $$INSERT INTO public.smp_waitlist_entries
      (user_id, minecraft_username, minecraft_uuid, average_viewers, stream_language, stream_frequency, twitch_broadcaster_type, twitch_follower_count)
    VALUES ('53300000-0000-4000-8000-0000000005c1', 'Player_C', '53300000-0000-4000-8000-00000000c001', 3, 'pt-br', 'few_per_week', 'affiliate', 120)$$,
  'the service role stores an application');
SELECT throws_ok(
  $$UPDATE public.smp_waitlist_entries SET minecraft_uuid = '53300000-0000-4000-8000-00000000a001'
    WHERE user_id = '53300000-0000-4000-8000-0000000005c1'$$,
  '23505', NULL, 'one Minecraft account is on the waitlist once');
SELECT throws_ok(
  $$UPDATE public.smp_waitlist_entries SET minecraft_username = 'no spaces!' WHERE user_id = '53300000-0000-4000-8000-0000000005c1'$$,
  '23514', NULL, 'a name Minecraft would not accept is refused');
SELECT throws_ok(
  $$UPDATE public.smp_waitlist_entries SET status = 'maybe' WHERE user_id = '53300000-0000-4000-8000-0000000005c1'$$,
  '23514', NULL, 'the status is one of pending, accepted, rejected');
SELECT throws_ok(
  $$UPDATE public.smp_waitlist_entries SET stream_frequency = 'sometimes' WHERE user_id = '53300000-0000-4000-8000-0000000005c1'$$,
  '23514', NULL, 'the stream frequency is one of the listed values');
SELECT lives_ok(
  $$UPDATE public.smp_waitlist_entries SET status = 'accepted', updated_at = '2000-01-01'
    WHERE user_id = '53300000-0000-4000-8000-0000000005c1'$$,
  'the service role reviews an application');
RESET ROLE;

SELECT results_eq(
  $$SELECT status, updated_at > '2001-01-01' FROM public.smp_waitlist_entries WHERE user_id = '53300000-0000-4000-8000-0000000005c1'$$,
  $$VALUES ('accepted', true)$$, 'updated_at is set by the trigger, not by the writer');

SELECT * FROM finish();
ROLLBACK;
