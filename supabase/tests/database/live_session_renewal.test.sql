-- StreamWizard Live session lifetime and renewal (20261123120000): the
-- create lifetime, renew_live_session's refusals, and that only the service
-- role may call either function.
-- Run: supabase test db --local
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(20);

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('5e140000-0000-4000-8000-0000000000a1', 'swirl140-a@test.local', '{"provider":"email"}', '{}'),
  ('5e140000-0000-4000-8000-0000000000b1', 'swirl140-b@test.local', '{"provider":"email"}', '{}');
INSERT INTO public.ingest_stream_keys (id, user_id, stream_key) VALUES
  ('5e140000-0000-4000-8000-0000000000a2', '5e140000-0000-4000-8000-0000000000a1', 'swirl140-key-a'),
  ('5e140000-0000-4000-8000-0000000000a3', '5e140000-0000-4000-8000-0000000000a1', 'swirl140-key-a2'),
  ('5e140000-0000-4000-8000-0000000000a4', '5e140000-0000-4000-8000-0000000000a1', 'swirl140-key-a3'),
  ('5e140000-0000-4000-8000-0000000000a5', '5e140000-0000-4000-8000-0000000000a1', 'swirl140-key-a4');

CREATE FUNCTION pg_temp.open_session(p_key uuid, p_stream_key text, p_wire text, p_lifetime_s integer)
RETURNS SETOF text LANGUAGE sql AS $$
  SELECT s.wire_id FROM public.create_live_session(
    '5e140000-0000-4000-8000-0000000000a1', p_key, p_stream_key, p_wire, 'ct', 'iv', 'tag', 1::smallint, NULL, p_lifetime_s) s
$$;
CREATE FUNCTION pg_temp.renew(p_wire text, p_user uuid, p_lifetime_s integer)
RETURNS SETOF timestamptz LANGUAGE sql AS $$
  SELECT s.expires_at FROM public.renew_live_session(p_wire, p_user, p_lifetime_s) s
$$;
GRANT EXECUTE ON FUNCTION pg_temp.open_session(uuid, text, text, integer), pg_temp.renew(text, uuid, integer) TO service_role;

-- Clients get nothing ----------------------------------------------------------
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT * FROM public.renew_live_session('00000000000000c1', '5e140000-0000-4000-8000-0000000000a1', 3600)$$,
  '42501', NULL, 'anon cannot renew a session');
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"5e140000-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  $$SELECT * FROM public.renew_live_session('00000000000000c1', '5e140000-0000-4000-8000-0000000000a1', 3600)$$,
  '42501', NULL, 'a signed-in user cannot renew through the function');
SELECT throws_ok(
  $$SELECT * FROM public.create_live_session('5e140000-0000-4000-8000-0000000000a1', '5e140000-0000-4000-8000-0000000000a2',
    'swirl140-key-a', '00000000000000c1', 'ct', 'iv', 'tag', 1::smallint, NULL, 3600)$$,
  '42501', NULL, 'a signed-in user cannot open a session through the function');
RESET ROLE;

SET LOCAL ROLE service_role;

-- Create: lifetime ----------------------------------------------------------------
SELECT results_eq($$SELECT pg_temp.open_session('5e140000-0000-4000-8000-0000000000a2', 'swirl140-key-a', '00000000000000c1', 600)$$,
  ARRAY['00000000000000c1'], 'the service role opens a session with a lifetime');
SELECT ok(
  (SELECT expires_at = created_at + interval '600 seconds' FROM public.live_sessions WHERE wire_id = '00000000000000c1'),
  'the session expires one lifetime after it was created');
SELECT results_eq(
  $$SELECT s.wire_id FROM public.create_live_session('5e140000-0000-4000-8000-0000000000a1', '5e140000-0000-4000-8000-0000000000a3',
    'swirl140-key-a2', '00000000000000c2', 'ct', 'iv', 'tag', 1::smallint, NULL) s$$,
  ARRAY['00000000000000c2'], 'a call without p_lifetime_s still works');
SELECT ok(
  (SELECT expires_at = created_at + interval '24 hours' FROM public.live_sessions WHERE wire_id = '00000000000000c2'),
  'without p_lifetime_s a session lasts 24 hours');
SELECT throws_ok($$SELECT pg_temp.open_session('5e140000-0000-4000-8000-0000000000a4', 'swirl140-key-a3', '00000000000000c3', 59)$$,
  '22023', NULL, 'a lifetime under 60 seconds is refused');
SELECT throws_ok($$SELECT pg_temp.open_session('5e140000-0000-4000-8000-0000000000a4', 'swirl140-key-a3', '00000000000000c3', 86401)$$,
  '22023', NULL, 'a lifetime over 24 hours is refused');

-- Renew ---------------------------------------------------------------------------
SELECT results_eq($$SELECT pg_temp.renew('00000000000000c1', '5e140000-0000-4000-8000-0000000000a1', 3600)$$,
  $$VALUES (now() + interval '3600 seconds')$$, 'the owner renews: expires_at is now plus the lifetime');
SELECT ok(
  (SELECT expires_at = now() + interval '3600 seconds' FROM public.live_sessions WHERE wire_id = '00000000000000c1'),
  'the renewal is stored');
SELECT results_eq($$SELECT pg_temp.renew('00000000000000c1', '5e140000-0000-4000-8000-0000000000a1', 60)$$,
  $$VALUES (now() + interval '60 seconds')$$, 'a renewal never leaves more than one lifetime ahead, also when shorter');
SELECT is_empty($$SELECT pg_temp.renew('00000000000000c1', '5e140000-0000-4000-8000-0000000000b1', 3600)$$,
  'another user cannot renew the session');
SELECT is_empty($$SELECT pg_temp.renew('00000000000000ff', '5e140000-0000-4000-8000-0000000000a1', 3600)$$,
  'an unknown session renews nothing');
SELECT throws_ok($$SELECT pg_temp.renew('00000000000000c1', '5e140000-0000-4000-8000-0000000000a1', 86401)$$,
  '22023', NULL, 'a renewal over 24 hours is refused');
RESET ROLE;

-- Sessions that may not be renewed (set up as postgres)
UPDATE public.live_sessions SET ended_at = now() WHERE wire_id = '00000000000000c2';
INSERT INTO public.live_sessions (wire_id, user_id, key_id, secret_ciphertext, secret_iv, secret_tag, protocol_version, created_at, expires_at)
VALUES
  ('00000000000000c4', '5e140000-0000-4000-8000-0000000000a1', '5e140000-0000-4000-8000-0000000000a4', 'ct', 'iv', 'tag', 1,
   now() - interval '2 days', now() - interval '1 day'),
  ('00000000000000c5', '5e140000-0000-4000-8000-0000000000a1', '5e140000-0000-4000-8000-0000000000a5', 'ct', 'iv', 'tag', 1,
   now(), now() + interval '1 hour');
-- A key that is off without its session being revoked (the trigger would
-- revoke it; this checks renew's own key check).
ALTER TABLE public.ingest_stream_keys DISABLE TRIGGER ingest_stream_keys_revoke_live_sessions;
UPDATE public.ingest_stream_keys SET is_active = false WHERE id = '5e140000-0000-4000-8000-0000000000a5';
ALTER TABLE public.ingest_stream_keys ENABLE TRIGGER ingest_stream_keys_revoke_live_sessions;

SET LOCAL ROLE service_role;
SELECT is_empty($$SELECT pg_temp.renew('00000000000000c2', '5e140000-0000-4000-8000-0000000000a1', 3600)$$,
  'an ended session is not renewed');
SELECT is_empty($$SELECT pg_temp.renew('00000000000000c4', '5e140000-0000-4000-8000-0000000000a1', 3600)$$,
  'an expired session is not renewed');
SELECT is_empty($$SELECT pg_temp.renew('00000000000000c5', '5e140000-0000-4000-8000-0000000000a1', 3600)$$,
  'a session whose key is off is not renewed');

-- A new session for the key revokes the renewed one.
SELECT results_eq($$SELECT pg_temp.open_session('5e140000-0000-4000-8000-0000000000a2', 'swirl140-key-a', '00000000000000c6', 3600)$$,
  ARRAY['00000000000000c6'], 'a new session for the same key opens');
SELECT is_empty($$SELECT pg_temp.renew('00000000000000c1', '5e140000-0000-4000-8000-0000000000a1', 3600)$$,
  'a revoked session is not renewed');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
