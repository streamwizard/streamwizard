-- Security definer functions: search_path, who may call them, and that the
-- tightened ones still work for their callers.
-- Run: supabase test db --local
-- Everything happens inside one transaction that is rolled back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(22);

-- Every public security definer function pins search_path --------------------
SELECT is_empty(
  $$SELECT p.oid::regprocedure::text
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prosecdef
      AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')$$,
  'every security definer function sets search_path');

SELECT is_empty(
  $$SELECT p.oid::regprocedure::text
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')$$,
  'anon cannot execute any security definer function');

SELECT is(
  (SELECT proconfig FROM pg_proc WHERE oid = 'public.check_product_access(text)'::regprocedure),
  ARRAY['search_path=""'], 'check_product_access uses an empty search_path');
SELECT is(
  (SELECT proconfig FROM pg_proc WHERE oid = 'public.get_product_access(text)'::regprocedure),
  ARRAY['search_path=""'], 'get_product_access uses an empty search_path');
SELECT is(
  (SELECT proconfig FROM pg_proc WHERE oid = 'public.increment_widget_installs(uuid)'::regprocedure),
  ARRAY['search_path=""'], 'increment_widget_installs uses an empty search_path');
SELECT is(
  (SELECT proconfig FROM pg_proc WHERE oid = 'public.insert_twitch_integration(uuid, jsonb)'::regprocedure),
  ARRAY['search_path=""'], 'insert_twitch_integration uses an empty search_path');

-- Grants -----------------------------------------------------------------------
SELECT ok(has_function_privilege('authenticated', 'public.check_product_access(text)', 'EXECUTE'),
  'authenticated can call check_product_access');
SELECT ok(has_function_privilege('authenticated', 'public.get_product_access(text)', 'EXECUTE'),
  'authenticated can call get_product_access');
SELECT ok(has_function_privilege('authenticated', 'public.increment_widget_installs(uuid)', 'EXECUTE'),
  'authenticated can call increment_widget_installs');
SELECT ok(NOT has_function_privilege('authenticated', 'public.next_ticket_number(text)', 'EXECUTE'),
  'authenticated cannot call next_ticket_number');
SELECT ok(has_function_privilege('service_role', 'public.next_ticket_number(text)', 'EXECUTE'),
  'service_role can call next_ticket_number');

-- Fixtures (as postgres). A Twitch signup runs the integration trigger and the
-- insert_* helpers with their new search_path.
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES (
  'f5000000-0000-4000-8000-000000000011', 'owner@example.test',
  '{"provider":"twitch"}', '{"nickname":"sw500owner","provider_id":"sw500-twitch-11","name":"sw500owner"}');
SELECT is(
  (SELECT twitch_username FROM public.integrations_twitch WHERE user_id = 'f5000000-0000-4000-8000-000000000011'),
  'sw500owner', 'Twitch signup still writes the integration row');

INSERT INTO public.user_subscriptions (user_id, plan_id, status) VALUES
  ('f5000000-0000-4000-8000-000000000011', 'cloud_obs_720p_30', 'active');

INSERT INTO public.overlay_widgets (id, user_id, name) VALUES
  ('f5000000-0000-4000-8000-0000000000b1', 'f5000000-0000-4000-8000-000000000011', 'Widget');
INSERT INTO public.overlay_widget_library_entries (id, widget_id, user_id, title, is_approved) VALUES
  ('f5000000-0000-4000-8000-0000000000c1', 'f5000000-0000-4000-8000-0000000000b1', 'f5000000-0000-4000-8000-000000000011', 'Approved', true),
  ('f5000000-0000-4000-8000-0000000000c2', 'f5000000-0000-4000-8000-0000000000b1', 'f5000000-0000-4000-8000-000000000011', 'Pending', false);

-- Visitors ---------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT public.increment_widget_installs('f5000000-0000-4000-8000-0000000000c1')$$,
  '42501', NULL, 'anon cannot bump install counts');
SELECT throws_ok($$SELECT public.check_product_access('cloud_obs')$$,
  '42501', NULL, 'anon cannot call check_product_access');
RESET ROLE;

-- The subscriber ---------------------------------------------------------------
SELECT set_config('request.jwt.claims',
  '{"sub":"f5000000-0000-4000-8000-000000000011","role":"authenticated","aal":"aal1"}', true);
SET LOCAL ROLE authenticated;
SELECT ok(public.check_product_access('cloud_obs'), 'subscriber has cloud_obs access');
SELECT ok(NOT public.check_product_access('ingest_server'), 'subscriber has no ingest_server access');
SELECT is((SELECT plan_id FROM public.get_product_access('cloud_obs')), 'cloud_obs_720p_30',
  'get_product_access returns the plan');
SELECT lives_ok($$SELECT public.increment_widget_installs('f5000000-0000-4000-8000-0000000000c1')$$,
  'subscriber can count an install');
SELECT lives_ok($$SELECT public.increment_widget_installs('f5000000-0000-4000-8000-0000000000c2')$$,
  'counting an unapproved entry does not error');
RESET ROLE;

SELECT is((SELECT installs FROM public.overlay_widget_library_entries WHERE id = 'f5000000-0000-4000-8000-0000000000c1'),
  1, 'install count goes up on an approved entry');
SELECT is((SELECT installs FROM public.overlay_widget_library_entries WHERE id = 'f5000000-0000-4000-8000-0000000000c2'),
  0, 'install count stays put on an unapproved entry');
SELECT is((SELECT is_approved FROM public.overlay_widget_library_entries WHERE id = 'f5000000-0000-4000-8000-0000000000c1'),
  true, 'counting an install keeps the entry approved');

SELECT * FROM finish();
ROLLBACK;
