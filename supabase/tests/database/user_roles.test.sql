-- Role rows are written by the service role only (20261028130200); users read
-- their own (20260630000001); check_user_role reads the caller's own rows.
-- The smp_admin read policy is covered with the template policies, not here.
-- Run: supabase test db --local
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(14);

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('50900000-0000-4000-8000-0000000001a1', 'sw509-roles-admin@test.local', '{"provider":"email"}', '{}'),
  ('50900000-0000-4000-8000-0000000001b1', 'sw509-roles-user@test.local', '{"provider":"email"}', '{}');
INSERT INTO public.user_roles (user_id, role) VALUES ('50900000-0000-4000-8000-0000000001a1', 'admin');

SELECT throws_ok($$INSERT INTO public.user_roles (user_id, role) VALUES ('50900000-0000-4000-8000-0000000001b1', 'superuser')$$,
  '23514', NULL, 'only known role names are stored');

-- Signed-in user without a role ------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000001b1","role":"authenticated","aal":"aal2"}';

SELECT ok(NOT public.check_user_role('admin'), 'check_user_role is false without a row');
SELECT is_empty('SELECT 1 FROM public.user_roles', 'a user without roles reads no role rows');
SELECT throws_ok($$INSERT INTO public.user_roles (user_id, role) VALUES ('50900000-0000-4000-8000-0000000001b1', 'admin')$$,
  '42501', NULL, 'a user cannot grant themselves admin');
SELECT throws_ok($$DELETE FROM public.user_roles WHERE user_id = '50900000-0000-4000-8000-0000000001a1'$$,
  '42501', NULL, 'a user cannot remove an admin');

-- Admin with a strong session ------------------------------------------------
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000001a1","role":"authenticated","aal":"aal2"}';

SELECT ok(public.check_user_role('admin'), 'check_user_role finds the caller''s own role');
SELECT results_eq($$SELECT role FROM public.user_roles WHERE user_id = '50900000-0000-4000-8000-0000000001a1'$$,
  ARRAY['admin'], 'an admin reads their own role row');
SELECT throws_ok($$INSERT INTO public.user_roles (user_id, role) VALUES ('50900000-0000-4000-8000-0000000001b1', 'admin')$$,
  '42501', NULL, 'even a strong admin cannot grant roles through the API');
SELECT throws_ok($$UPDATE public.user_roles SET role = 'smp_admin' WHERE user_id = '50900000-0000-4000-8000-0000000001a1'$$,
  '42501', NULL, 'even a strong admin cannot change roles through the API');
SELECT throws_ok($$DELETE FROM public.user_roles WHERE user_id = '50900000-0000-4000-8000-0000000001a1'$$,
  '42501', NULL, 'even a strong admin cannot remove roles through the API');
RESET ROLE;

-- Visitors ---------------------------------------------------------------------
SELECT ok(NOT has_function_privilege('anon', 'public.check_user_role(text)', 'EXECUTE'),
  'anon cannot execute check_user_role');
SELECT ok(NOT has_function_privilege('authenticated', 'public.check_user_role(uuid, text)', 'EXECUTE'),
  'authenticated cannot ask about another user''s roles');
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" TO '{"role":"anon"}';
SELECT throws_ok($$INSERT INTO public.user_roles (user_id, role) VALUES ('50900000-0000-4000-8000-0000000001b1', 'admin')$$,
  '42501', NULL, 'anon cannot write roles');
RESET ROLE;

-- The service role still can.
SET LOCAL ROLE service_role;
SELECT lives_ok($$INSERT INTO public.user_roles (user_id, role) VALUES ('50900000-0000-4000-8000-0000000001b1', 'smp_admin')$$,
  'the service role grants roles');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
