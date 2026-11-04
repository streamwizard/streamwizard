-- Ingest stream/output keys and Cloud OBS instances: users read (and for OBS,
-- delete) their own rows; creating and changing them is service role only,
-- after the plan check (20261028130900, 20260623000000).
-- Run: supabase test db --local
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(20);

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('50900000-0000-4000-8000-0000000006a1', 'sw509-ingest-a@test.local', '{"provider":"email"}', '{}'),
  ('50900000-0000-4000-8000-0000000006b1', 'sw509-ingest-b@test.local', '{"provider":"email"}', '{}');
INSERT INTO public.ingest_stream_keys (id, user_id, stream_key) VALUES
  ('50900000-0000-4000-8000-0000000006a2', '50900000-0000-4000-8000-0000000006a1', 'sw509-stream-key-a');
INSERT INTO public.ingest_output_keys (id, user_id, key_id, output_key) VALUES
  ('50900000-0000-4000-8000-0000000006a3', '50900000-0000-4000-8000-0000000006a1', '50900000-0000-4000-8000-0000000006a2', 'sw509-output-key-a');
INSERT INTO public.obs_nodes (id, name, max_instances) VALUES
  ('50900000-0000-4000-8000-0000000006c1', 'sw509-node', 4);
INSERT INTO public.obs_instances (id, user_id, node_id, container_name, resolution, vram_allocated_mb, memory_mb, cpu_quota, shm_size) VALUES
  ('50900000-0000-4000-8000-0000000006a4', '50900000-0000-4000-8000-0000000006a1', '50900000-0000-4000-8000-0000000006c1', 'sw509-a', '1080p', 512, 2048, 2, '1g'),
  ('50900000-0000-4000-8000-0000000006b4', '50900000-0000-4000-8000-0000000006b1', '50900000-0000-4000-8000-0000000006c1', 'sw509-b', '1080p', 512, 2048, 2, '1g');

-- Owner ------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000006a1","role":"authenticated","aal":"aal1"}';

SELECT results_eq('SELECT stream_key FROM public.ingest_stream_keys', ARRAY['sw509-stream-key-a'], 'the owner reads their ingest key');
SELECT results_eq('SELECT output_key FROM public.ingest_output_keys', ARRAY['sw509-output-key-a'], 'the owner reads their output key');
SELECT throws_ok(
  $$INSERT INTO public.ingest_stream_keys (user_id, stream_key) VALUES ('50900000-0000-4000-8000-0000000006a1', 'sw509-minted')$$,
  '42501', NULL, 'the owner cannot mint ingest keys directly');
SELECT throws_ok(
  $$INSERT INTO public.ingest_output_keys (user_id, key_id, output_key) VALUES ('50900000-0000-4000-8000-0000000006a1', '50900000-0000-4000-8000-0000000006a2', 'sw509-minted')$$,
  '42501', NULL, 'the owner cannot mint output keys directly');
SELECT throws_ok($$UPDATE public.ingest_stream_keys SET is_active = true$$,
  '42501', NULL, 'the owner cannot re-enable an ingest key directly');
SELECT throws_ok($$DELETE FROM public.ingest_output_keys$$,
  '42501', NULL, 'the owner cannot delete output keys directly');

SELECT results_eq('SELECT container_name FROM public.obs_instances', ARRAY['sw509-a'], 'the owner reads only their own OBS instances');
SELECT is_empty(
  $$WITH u AS (UPDATE public.obs_instances SET storage_quota_mb = 999999 RETURNING 1) SELECT * FROM u$$,
  'the owner cannot change their instance''s limits');
SELECT throws_ok(
  $$INSERT INTO public.obs_instances (user_id, node_id, container_name, resolution, vram_allocated_mb, memory_mb, cpu_quota, shm_size)
    VALUES ('50900000-0000-4000-8000-0000000006a1', '50900000-0000-4000-8000-0000000006c1', 'sw509-free', '1080p', 512, 2048, 2, '1g')$$,
  '42501', NULL, 'the owner cannot create an OBS instance without the server');
SELECT results_eq(
  $$WITH d AS (DELETE FROM public.obs_instances WHERE id = '50900000-0000-4000-8000-0000000006a4' RETURNING container_name) SELECT container_name FROM d$$,
  ARRAY['sw509-a'], 'the owner can delete their own instance');

-- Another signed-in user -------------------------------------------------------
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000006b1","role":"authenticated","aal":"aal1"}';

SELECT is_empty('SELECT 1 FROM public.ingest_stream_keys', 'another user cannot read the ingest key');
SELECT is_empty('SELECT 1 FROM public.ingest_output_keys', 'another user cannot read the output key');
SELECT throws_ok(
  $$INSERT INTO public.ingest_stream_keys (user_id, stream_key) VALUES ('50900000-0000-4000-8000-0000000006b1', 'sw509-minted-b')$$,
  '42501', NULL, 'a user without a plan cannot mint ingest keys');
SELECT results_eq('SELECT container_name FROM public.obs_instances', ARRAY['sw509-b'], 'another user sees only their own instance');
SELECT is_empty(
  $$WITH d AS (DELETE FROM public.obs_instances WHERE node_id = '50900000-0000-4000-8000-0000000006c1' AND user_id <> '50900000-0000-4000-8000-0000000006b1' RETURNING 1) SELECT * FROM d$$,
  'another user cannot delete someone else''s instance');
SELECT is_empty('SELECT 1 FROM public.obs_nodes WHERE name = ''sw509-node''', 'users cannot read the OBS node registry');
RESET ROLE;

-- Visitors ---------------------------------------------------------------------
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" TO '{"role":"anon"}';
SELECT is_empty('SELECT 1 FROM public.ingest_stream_keys', 'anon reads no ingest keys');
SELECT is_empty('SELECT 1 FROM public.obs_instances', 'anon reads no OBS instances');
SELECT throws_ok(
  $$INSERT INTO public.ingest_stream_keys (user_id, stream_key) VALUES ('50900000-0000-4000-8000-0000000006a1', 'sw509-anon')$$,
  '42501', NULL, 'anon cannot mint ingest keys');
SELECT is_empty('SELECT 1 FROM public.obs_nodes WHERE name = ''sw509-node''', 'anon cannot read the OBS node registry');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
