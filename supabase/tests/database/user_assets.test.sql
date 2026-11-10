-- Media library rows are read-only for users (20261003120000); uploads reserve
-- quota through reserve_user_asset, service role only (20261003120100).
-- Run: supabase test db --local
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(18);

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('50900000-0000-4000-8000-0000000008a1', 'sw509-assets-a@test.local', '{"provider":"email"}', '{}'),
  ('50900000-0000-4000-8000-0000000008b1', 'sw509-assets-b@test.local', '{"provider":"email"}', '{}');
-- A ready 600-byte asset: the usage trigger counts it.
INSERT INTO public.user_assets (id, user_id, key, file_name, mime_type, size_bytes, kind, status) VALUES
  ('50900000-0000-4000-8000-0000000008a2', '50900000-0000-4000-8000-0000000008a1', 'assets/sw509/a/one.png', 'one.png', 'image/png', 600, 'image', 'ready');

-- Grants on the reservation function ---------------------------------------------
SELECT ok(NOT has_function_privilege('anon', 'public.reserve_user_asset(uuid, uuid, text, text, text, bigint, text, bigint, timestamptz)', 'EXECUTE'),
  'anon cannot execute reserve_user_asset');
SELECT ok(NOT has_function_privilege('authenticated', 'public.reserve_user_asset(uuid, uuid, text, text, text, bigint, text, bigint, timestamptz)', 'EXECUTE'),
  'authenticated cannot execute reserve_user_asset (it takes any user id and quota)');
SELECT ok(has_function_privilege('service_role', 'public.reserve_user_asset(uuid, uuid, text, text, text, bigint, text, bigint, timestamptz)', 'EXECUTE'),
  'the service role can execute reserve_user_asset');

-- Quota behaviour (as the service role, like the upload action) ------------------
SET LOCAL ROLE service_role;
SELECT results_eq($$SELECT used_bytes FROM public.user_storage_usage WHERE user_id = '50900000-0000-4000-8000-0000000008a1'$$,
  ARRAY[600::bigint], 'a ready asset counts towards usage');
SELECT ok(public.reserve_user_asset('50900000-0000-4000-8000-0000000008a1', '50900000-0000-4000-8000-0000000008a3',
  'assets/sw509/a/two.png', 'two.png', 'image/png', 300, 'image', 1000, now() - interval '1 hour'),
  'a reservation that fits the quota is accepted');
SELECT results_eq($$SELECT status FROM public.user_assets WHERE id = '50900000-0000-4000-8000-0000000008a3'$$,
  ARRAY['pending'], 'the reservation is a pending row');
SELECT ok(NOT public.reserve_user_asset('50900000-0000-4000-8000-0000000008a1', '50900000-0000-4000-8000-0000000008a4',
  'assets/sw509/a/three.png', 'three.png', 'image/png', 200, 'image', 1000, now() - interval '1 hour'),
  'ready bytes plus live reservations over the quota are refused');
SELECT is_empty($$SELECT 1 FROM public.user_assets WHERE id = '50900000-0000-4000-8000-0000000008a4'$$,
  'a refused reservation writes nothing');
SELECT ok(public.reserve_user_asset('50900000-0000-4000-8000-0000000008a1', '50900000-0000-4000-8000-0000000008a5',
  'assets/sw509/a/four.png', 'four.png', 'image/png', 200, 'image', 1000, now() + interval '1 minute'),
  'reservations older than the cutoff no longer count');
SELECT ok(public.reserve_user_asset('50900000-0000-4000-8000-0000000008b1', '50900000-0000-4000-8000-0000000008b2',
  'assets/sw509/b/one.png', 'one.png', 'image/png', 900, 'image', 1000, now() - interval '1 hour'),
  'quota is per user');
RESET ROLE;

-- Owner ------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000008a1","role":"authenticated","aal":"aal1"}';

SELECT results_eq('SELECT count(*)::int FROM public.user_assets', ARRAY[3], 'the owner reads their own assets');
SELECT throws_ok($$UPDATE public.user_assets SET size_bytes = 0$$,
  '42501', NULL, 'the owner cannot shrink an asset to dodge the quota');
SELECT throws_ok($$UPDATE public.user_assets SET key = 'assets/sw509/b/one.png'$$,
  '42501', NULL, 'the owner cannot point an asset at another object');
SELECT throws_ok(
  $$INSERT INTO public.user_assets (user_id, key, file_name, mime_type, size_bytes, kind) VALUES ('50900000-0000-4000-8000-0000000008a1', 'assets/sw509/a/x.png', 'x.png', 'image/png', 1, 'image')$$,
  '42501', NULL, 'the owner cannot insert assets directly');
SELECT throws_ok($$DELETE FROM public.user_assets$$, '42501', NULL, 'the owner cannot delete asset rows directly');
SELECT is_empty(
  $$WITH u AS (UPDATE public.user_storage_usage SET used_bytes = 0 RETURNING 1) SELECT * FROM u$$,
  'the owner cannot reset their storage usage');

-- Another signed-in user -------------------------------------------------------
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000008b1","role":"authenticated","aal":"aal1"}';
SELECT is_empty($$SELECT 1 FROM public.user_assets WHERE user_id = '50900000-0000-4000-8000-0000000008a1'$$,
  'another user cannot read A''s assets');
RESET ROLE;

-- Visitors ---------------------------------------------------------------------
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" TO '{"role":"anon"}';
SELECT is_empty('SELECT 1 FROM public.user_assets', 'anon reads no assets');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
