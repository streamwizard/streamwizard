-- user_states: users write their own keys, never the server-owned sys.* keys,
-- whether directly or through apply_user_state_op (20260807140000,
-- 20260813120000).
-- Run: supabase test db --local
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(16);

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('50900000-0000-4000-8000-0000000007a1', 'sw509-state-a@test.local', '{"provider":"email"}', '{}'),
  ('50900000-0000-4000-8000-0000000007b1', 'sw509-state-b@test.local', '{"provider":"email"}', '{}');
INSERT INTO public.user_states (user_id, key, value) VALUES
  ('50900000-0000-4000-8000-0000000007a1', 'sys.stream_id', '"stream-1"'),
  ('50900000-0000-4000-8000-0000000007a1', 'deaths', '3');

SELECT ok(NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.apply_user_state_op(uuid, text, text, jsonb)'::regprocedure),
  'apply_user_state_op is security invoker (RLS applies to every caller)');

-- Owner ------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000007a1","role":"authenticated","aal":"aal1"}';

SELECT results_eq('SELECT key FROM public.user_states ORDER BY key', ARRAY['deaths', 'sys.stream_id'],
  'the owner reads their keys, system keys included');
SELECT lives_ok($$INSERT INTO public.user_states (user_id, key, value) VALUES ('50900000-0000-4000-8000-0000000007a1', 'distance', '0')$$,
  'the owner adds a key');
SELECT results_eq($$SELECT (public.apply_user_state_op('50900000-0000-4000-8000-0000000007a1', 'deaths', 'increment', '1'))->>'value'$$,
  ARRAY['4'], 'the owner increments a counter through the RPC');
SELECT throws_ok($$INSERT INTO public.user_states (user_id, key, value) VALUES ('50900000-0000-4000-8000-0000000007a1', 'sys.stream_ended_at', '"x"')$$,
  '42501', NULL, 'the owner cannot create a sys.* key');
SELECT is_empty(
  $$WITH u AS (UPDATE public.user_states SET value = '"forged"' WHERE key = 'sys.stream_id' RETURNING 1) SELECT * FROM u$$,
  'the owner cannot overwrite a sys.* key');
SELECT is_empty(
  $$WITH d AS (DELETE FROM public.user_states WHERE key = 'sys.stream_id' RETURNING 1) SELECT * FROM d$$,
  'the owner cannot delete a sys.* key');
SELECT throws_ok($$UPDATE public.user_states SET key = 'sys.stream_id_2' WHERE key = 'deaths'$$,
  '42501', NULL, 'the owner cannot rename a key into the sys.* namespace');
SELECT throws_ok($$SELECT public.apply_user_state_op('50900000-0000-4000-8000-0000000007a1', 'sys.stream_id', 'set', '"forged"')$$,
  '42501', NULL, 'the RPC cannot write a sys.* key either');
SELECT throws_ok($$INSERT INTO public.user_states (user_id, key, value) VALUES ('50900000-0000-4000-8000-0000000007a1', 'Bad.Key', '0')$$,
  '23514', NULL, 'a dot is only legal behind the sys. prefix');

-- Another signed-in user -------------------------------------------------------
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000007b1","role":"authenticated","aal":"aal1"}';

SELECT is_empty('SELECT 1 FROM public.user_states', 'another user reads none of A''s state');
SELECT throws_ok($$SELECT public.apply_user_state_op('50900000-0000-4000-8000-0000000007a1', 'deaths', 'set', '0')$$,
  '42501', NULL, 'another user cannot write A''s state through the RPC');
SELECT is_empty(
  $$WITH u AS (UPDATE public.user_states SET value = '0' WHERE user_id = '50900000-0000-4000-8000-0000000007a1' RETURNING 1) SELECT * FROM u$$,
  'another user cannot change A''s state');
SELECT throws_ok(
  $$INSERT INTO public.user_state_definitions (user_id, key, reset_policy) VALUES ('50900000-0000-4000-8000-0000000007a1', 'deaths', 'stream')$$,
  '42501', NULL, 'another user cannot give A''s key a reset policy');
RESET ROLE;

-- Visitors ---------------------------------------------------------------------
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" TO '{"role":"anon"}';
SELECT is_empty('SELECT 1 FROM public.user_states', 'anon reads no state');
SELECT throws_ok($$INSERT INTO public.user_states (user_id, key, value) VALUES ('50900000-0000-4000-8000-0000000007a1', 'deaths', '0')$$,
  '42501', NULL, 'anon cannot write state');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
