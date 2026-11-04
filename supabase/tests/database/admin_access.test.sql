-- Admin rights in SQL need the admin role *and* a TOTP-verified (aal2)
-- session: is_strong_admin() and the admin policies built on it
-- (20261028130000, 20261029160000, 20261028130100).
-- Run: supabase test db --local
-- Everything happens inside one transaction that is rolled back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(26);

-- Fixtures (as postgres). handle_new_user creates the public.users rows.
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('50900000-0000-4000-8000-0000000000a1', 'sw509-admin@test.local', '{"provider":"email"}', '{}'),
  ('50900000-0000-4000-8000-0000000000b1', 'sw509-user@test.local', '{"provider":"email"}', '{}');
INSERT INTO public.user_roles (user_id, role) VALUES ('50900000-0000-4000-8000-0000000000a1', 'admin');

INSERT INTO public.alert_events (rule_id, env, event_type, message)
  VALUES ('sw509.rule', 'dev', 'fired', 'sw509 alert');
INSERT INTO public.backup_events (source, event_type, severity, title, occurred_at, dedupe_key)
  VALUES ('pbs', 'job', 'info', 'sw509 backup', now(), 'sw509-backup-1');
SELECT public.emit_platform_event('swtest.admin_access', '50900000-0000-4000-8000-0000000000b1', NULL, '{}');
INSERT INTO public.products (id, name) VALUES ('sw509_product', 'SW-509 product');
INSERT INTO public.plans (id, product_id, name) VALUES ('sw509_plan', 'sw509_product', 'SW-509 plan');
INSERT INTO public.user_subscriptions (user_id, plan_id, status)
  VALUES ('50900000-0000-4000-8000-0000000000b1', 'sw509_plan', 'active');
INSERT INTO public.feedback (user_id, category, priority, title, description)
  VALUES ('50900000-0000-4000-8000-0000000000b1', 'bug', 'low', 'SW-509', 'sw509 feedback');

-- Who may call the helper ------------------------------------------------------
SELECT ok(NOT has_function_privilege('anon', 'public.is_strong_admin()', 'EXECUTE'),
  'anon cannot execute is_strong_admin');
SELECT ok(has_function_privilege('authenticated', 'public.is_strong_admin()', 'EXECUTE'),
  'authenticated can execute is_strong_admin (the policies call it)');

-- Admin with a plain Twitch session (aal1) ------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal1"}';

SELECT ok(public.check_user_role('admin'), 'the admin role itself is found');
SELECT ok(NOT public.is_strong_admin(), 'aal1 admin is not a strong admin');
SELECT is_empty('SELECT 1 FROM public.alert_events', 'aal1 admin reads no alert events');
SELECT is_empty('SELECT 1 FROM public.backup_events', 'aal1 admin reads no backup events');
SELECT is_empty('SELECT 1 FROM public.platform_events', 'aal1 admin reads no platform events');
SELECT is_empty($$SELECT 1 FROM public.user_subscriptions WHERE plan_id = 'sw509_plan'$$,
  'aal1 admin reads no one else''s subscription');
SELECT is_empty($$SELECT 1 FROM public.feedback WHERE description = 'sw509 feedback'$$,
  'aal1 admin reads no one else''s feedback');

-- A passkey entry in amr no longer counts as the second factor (SW-483).
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal1","amr":[{"method":"passkey","timestamp":1}]}';
SELECT ok(NOT public.is_strong_admin(), 'aal1 admin with a passkey amr is not a strong admin');
SELECT is_empty('SELECT 1 FROM public.alert_events', 'passkey-only admin reads no alert events');

-- Admin with a TOTP-verified session (aal2) -----------------------------------
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal2"}';

SELECT ok(public.is_strong_admin(), 'aal2 admin is a strong admin');
SELECT results_eq($$SELECT message FROM public.alert_events WHERE rule_id = 'sw509.rule'$$,
  ARRAY['sw509 alert'], 'aal2 admin reads alert events');
SELECT results_eq($$SELECT title FROM public.backup_events WHERE dedupe_key = 'sw509-backup-1'$$,
  ARRAY['sw509 backup'], 'aal2 admin reads backup events');
SELECT results_eq($$SELECT event_type FROM public.platform_events WHERE event_type = 'swtest.admin_access'$$,
  ARRAY['swtest.admin_access'], 'aal2 admin reads platform events');
SELECT results_eq($$SELECT description FROM public.feedback WHERE description = 'sw509 feedback'$$,
  ARRAY['sw509 feedback'], 'aal2 admin reads everyone''s feedback');
SELECT results_eq(
  $$WITH u AS (UPDATE public.user_subscriptions SET status = 'past_due' WHERE plan_id = 'sw509_plan' RETURNING status) SELECT status FROM u$$,
  ARRAY['past_due'], 'aal2 admin can change another user''s subscription');

-- Signed-in user without the admin role, even at aal2 ------------------------
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000000b1","role":"authenticated","aal":"aal2"}';

SELECT ok(NOT public.is_strong_admin(), 'non-admin at aal2 is not a strong admin');
SELECT is_empty('SELECT 1 FROM public.alert_events', 'non-admin reads no alert events');
SELECT is_empty('SELECT 1 FROM public.platform_events', 'non-admin reads no platform events');
SELECT results_eq($$SELECT plan_id FROM public.user_subscriptions$$,
  ARRAY['sw509_plan'], 'non-admin reads only their own subscription');
SELECT is_empty(
  $$WITH u AS (UPDATE public.user_subscriptions SET status = 'active' WHERE plan_id = 'sw509_plan' RETURNING 1) SELECT * FROM u$$,
  'non-admin cannot change their own subscription');

RESET ROLE;

-- users.role is not an admin flag (20261028130100) ----------------------------
UPDATE public.users SET role = 'admin' WHERE id = '50900000-0000-4000-8000-0000000000b1';
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000000b1","role":"authenticated","aal":"aal2"}';
SELECT ok(NOT public.is_strong_admin(), 'users.role = admin does not make a strong admin');
SELECT throws_ok($$UPDATE public.users SET role = 'admin' WHERE id = '50900000-0000-4000-8000-0000000000b1'$$,
  '42501', NULL, 'a user cannot write their own users row');
RESET ROLE;

-- Visitors ---------------------------------------------------------------------
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" TO '{"role":"anon"}';
SELECT is_empty('SELECT 1 FROM public.alert_events', 'anon reads no alert events');
SELECT is_empty('SELECT 1 FROM public.user_subscriptions', 'anon reads no subscriptions');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
