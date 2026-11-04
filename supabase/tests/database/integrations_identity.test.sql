-- The Twitch and Discord ids on an account can only come from the provider:
-- integrations_twitch column grants and the signup conflict event
-- (20261028130300), link_discord_integration's identity check (20261028130400).
-- Run: supabase test db --local
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(20);

-- Two Twitch signups. The signup triggers write users, integrations and
-- integrations_twitch from the OAuth metadata.
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('50900000-0000-4000-8000-0000000002a1', 'sw509-int-a@test.local', '{"provider":"twitch"}',
   '{"provider_id":"9509000201","nickname":"sw509_streamer_a"}'),
  ('50900000-0000-4000-8000-0000000002b1', 'sw509-int-b@test.local', '{"provider":"twitch"}',
   '{"provider_id":"9509000202","nickname":"sw509_streamer_b"}');

SELECT results_eq($$SELECT twitch_user_id FROM public.integrations_twitch WHERE user_id = '50900000-0000-4000-8000-0000000002a1'$$,
  ARRAY['9509000201'], 'a Twitch signup gets its integration row');

-- A third signup with a Twitch id that is already taken still gets in, has no
-- integration, and leaves a user.twitch_conflict event for staff.
SELECT lives_ok($$INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('50900000-0000-4000-8000-0000000002c1', 'sw509-int-c@test.local', '{"provider":"twitch"}',
   '{"provider_id":"9509000201","nickname":"sw509_copycat"}')$$,
  'a signup with a taken Twitch id is not blocked');
SELECT is_empty($$SELECT 1 FROM public.integrations_twitch WHERE user_id = '50900000-0000-4000-8000-0000000002c1'$$,
  'the conflicting signup gets no Twitch integration');
SELECT results_eq($$SELECT payload->>'existing_user_id' FROM public.platform_events
    WHERE event_type = 'user.twitch_conflict' AND subject_user_id = '50900000-0000-4000-8000-0000000002c1'$$,
  ARRAY['50900000-0000-4000-8000-0000000002a1'], 'the conflict is logged with the account that holds the id');

-- Column grants on integrations_twitch -------------------------------------------
SELECT ok(has_column_privilege('authenticated', 'public.integrations_twitch', 'access_token_ciphertext', 'UPDATE'),
  'authenticated may update the token columns');
SELECT ok(NOT has_column_privilege('authenticated', 'public.integrations_twitch', 'twitch_user_id', 'UPDATE'),
  'authenticated may not update twitch_user_id');
SELECT ok(NOT has_column_privilege('authenticated', 'public.integrations_twitch', 'user_id', 'UPDATE'),
  'authenticated may not update user_id');
SELECT ok(NOT has_table_privilege('authenticated', 'public.integrations_twitch', 'INSERT'),
  'authenticated may not insert Twitch integrations');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000002b1","role":"authenticated","aal":"aal1"}';

SELECT results_eq('SELECT twitch_user_id FROM public.integrations_twitch',
  ARRAY['9509000202'], 'a user reads only their own Twitch integration');
SELECT results_eq(
  $$WITH u AS (UPDATE public.integrations_twitch SET twitch_scopes = ARRAY['clips:edit'] RETURNING twitch_user_id) SELECT twitch_user_id FROM u$$,
  ARRAY['9509000202'], 'the owner can store new scopes');
SELECT throws_ok($$UPDATE public.integrations_twitch SET twitch_user_id = '9509000299'$$,
  '42501', NULL, 'the owner cannot point their account at another channel');
SELECT is_empty(
  $$WITH u AS (UPDATE public.integrations_twitch SET twitch_scopes = '{}' WHERE user_id = '50900000-0000-4000-8000-0000000002a1' RETURNING 1) SELECT * FROM u$$,
  'a user cannot touch another user''s Twitch integration');

-- link_discord_integration ---------------------------------------------------------
SELECT throws_ok($$SELECT public.link_discord_integration('950900000000000201', 'not_mine', NULL, NULL)$$,
  '42501', NULL, 'linking a Discord id the caller has no identity for is refused');
SELECT is_empty('SELECT 1 FROM public.integrations_discord', 'nothing was linked');
SELECT throws_ok($$UPDATE public.integrations_discord SET discord_user_id = 'x'$$,
  '42501', NULL, 'authenticated cannot update integrations_discord directly');
RESET ROLE;

-- GoTrue writes the identity after a completed Discord OAuth round trip.
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider)
  VALUES ('950900000000000202', '50900000-0000-4000-8000-0000000002b1', '{"sub":"950900000000000202"}', 'discord');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000002b1","role":"authenticated","aal":"aal1"}';
SELECT lives_ok($$SELECT public.link_discord_integration('950900000000000202', 'sw509_b', NULL, NULL)$$,
  'linking the caller''s own Discord identity works');
SELECT results_eq('SELECT discord_user_id FROM public.integrations_discord',
  ARRAY['950900000000000202'], 'the linked id is the identity''s id');

-- Another user cannot reuse B's identity.
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000002a1","role":"authenticated","aal":"aal1"}';
SELECT throws_ok($$SELECT public.link_discord_integration('950900000000000202', 'stolen', NULL, NULL)$$,
  '42501', NULL, 'linking someone else''s Discord identity is refused');
RESET ROLE;

SELECT ok(NOT has_function_privilege('anon', 'public.link_discord_integration(text, text, text, text)', 'EXECUTE'),
  'anon cannot execute link_discord_integration');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"role":"authenticated"}';
SELECT throws_ok($$SELECT public.link_discord_integration('950900000000000202', 'x', NULL, NULL)$$,
  'P0001', 'Not authenticated', 'a token without a user is refused');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
