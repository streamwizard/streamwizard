-- StreamWizard Live sessions (20261120120000): service role only, one open
-- session per stream key, and a rotated or deactivated key revokes its open
-- sessions.
-- Run: supabase test db --local
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(17);

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('5e460000-0000-4000-8000-0000000000a1', 'swirl46-a@test.local', '{"provider":"email"}', '{}'),
  ('5e460000-0000-4000-8000-0000000000b1', 'swirl46-b@test.local', '{"provider":"email"}', '{}');
INSERT INTO public.ingest_stream_keys (id, user_id, stream_key) VALUES
  ('5e460000-0000-4000-8000-0000000000a2', '5e460000-0000-4000-8000-0000000000a1', 'swirl46-key-a'),
  ('5e460000-0000-4000-8000-0000000000a3', '5e460000-0000-4000-8000-0000000000a1', 'swirl46-key-a2');

CREATE FUNCTION pg_temp.open_session(p_key uuid, p_stream_key text, p_wire text)
RETURNS SETOF text LANGUAGE sql AS $$
  SELECT s.wire_id FROM public.create_live_session(
    '5e460000-0000-4000-8000-0000000000a1', p_key, p_stream_key, p_wire, 'ct', 'iv', 'tag', 1::smallint, '10.0.0.1') s
$$;
CREATE FUNCTION pg_temp.open_wire_ids() RETURNS SETOF text LANGUAGE sql AS $$
  SELECT wire_id FROM public.live_sessions WHERE revoked_at IS NULL AND ended_at IS NULL ORDER BY wire_id
$$;
GRANT EXECUTE ON FUNCTION pg_temp.open_session(uuid, text, text), pg_temp.open_wire_ids() TO service_role;

-- Clients get nothing ----------------------------------------------------------
SET LOCAL ROLE anon;
SELECT throws_ok('SELECT 1 FROM public.live_sessions', '42501', NULL, 'anon cannot read live sessions');
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"5e460000-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal1"}';
SELECT throws_ok('SELECT 1 FROM public.live_sessions', '42501', NULL, 'the owner cannot read live sessions directly');
SELECT throws_ok(
  $$SELECT * FROM public.create_live_session('5e460000-0000-4000-8000-0000000000a1', '5e460000-0000-4000-8000-0000000000a2',
    'swirl46-key-a', '00000000000000a1', 'ct', 'iv', 'tag', 1::smallint, NULL)$$,
  '42501', NULL, 'a signed-in user cannot open a session through the function');
RESET ROLE;

-- The service role opens sessions ---------------------------------------------
SET LOCAL ROLE service_role;
SELECT results_eq($$SELECT pg_temp.open_session('5e460000-0000-4000-8000-0000000000a2', 'swirl46-key-a', '00000000000000a1')$$,
  ARRAY['00000000000000a1'], 'the service role opens a session');
SELECT ok(
  (SELECT expires_at = created_at + interval '24 hours' FROM public.live_sessions WHERE wire_id = '00000000000000a1'),
  'a session expires 24 hours after it was created');
SELECT results_eq($$SELECT pg_temp.open_session('5e460000-0000-4000-8000-0000000000a3', 'swirl46-key-a2', '00000000000000a3')$$,
  ARRAY['00000000000000a3'], 'a second key gets its own session');

SELECT results_eq($$SELECT pg_temp.open_session('5e460000-0000-4000-8000-0000000000a2', 'swirl46-key-a', '00000000000000a2')$$,
  ARRAY['00000000000000a2'], 'a new session for the same key opens');
SELECT results_eq('SELECT pg_temp.open_wire_ids()', ARRAY['00000000000000a2', '00000000000000a3'],
  'the new session revoked the key''s previous one, not the other key''s');

SELECT is_empty($$SELECT pg_temp.open_session('5e460000-0000-4000-8000-0000000000a2', 'swirl46-old-key', '00000000000000a4')$$,
  'no session when the stream key no longer matches');
SELECT is_empty(
  $$SELECT s.wire_id FROM public.create_live_session('5e460000-0000-4000-8000-0000000000b1', '5e460000-0000-4000-8000-0000000000a2',
    'swirl46-key-a', '00000000000000b1', 'ct', 'iv', 'tag', 1::smallint, NULL) s$$,
  'no session for a key the user does not own');
SELECT results_eq('SELECT pg_temp.open_wire_ids()', ARRAY['00000000000000a2', '00000000000000a3'],
  'a refused open revokes nothing');

SELECT throws_ok($$SELECT pg_temp.open_session('5e460000-0000-4000-8000-0000000000a3', 'swirl46-key-a2', '0000000000000000')$$,
  '23514', NULL, 'the all-zero wire id is refused');
SELECT throws_ok($$SELECT pg_temp.open_session('5e460000-0000-4000-8000-0000000000a3', 'swirl46-key-a2', '00000000000000A3')$$,
  '23514', NULL, 'an upper-case wire id is refused');
SELECT throws_ok($$SELECT pg_temp.open_session('5e460000-0000-4000-8000-0000000000a3', 'swirl46-key-a2', '00000000000000a2')$$,
  '23505', NULL, 'wire ids are unique');
RESET ROLE;

-- Key changes revoke open sessions (as postgres, like the dashboard's admin client)
UPDATE public.ingest_stream_keys SET label = 'Renamed' WHERE id = '5e460000-0000-4000-8000-0000000000a2';
SELECT results_eq('SELECT pg_temp.open_wire_ids()', ARRAY['00000000000000a2', '00000000000000a3'],
  'renaming a key keeps its session');

UPDATE public.ingest_stream_keys SET stream_key = 'swirl46-key-a-rotated' WHERE id = '5e460000-0000-4000-8000-0000000000a2';
SELECT results_eq('SELECT pg_temp.open_wire_ids()', ARRAY['00000000000000a3'],
  'rotating a key revokes its open session');

UPDATE public.ingest_stream_keys SET is_active = false WHERE id = '5e460000-0000-4000-8000-0000000000a3';
SELECT is_empty('SELECT pg_temp.open_wire_ids()', 'turning a key off revokes its open session');

SELECT * FROM finish();
ROLLBACK;
