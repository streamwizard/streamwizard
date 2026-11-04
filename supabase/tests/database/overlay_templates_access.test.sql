-- Who can read and write overlay templates, and who reads user_roles.
-- Run: supabase test db --local
-- Everything happens inside one transaction that is rolled back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(19);

-- Fixtures (as postgres). Signup triggers create the public.users rows.
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('f5000000-0000-4000-8000-000000000001', 'smp-admin@example.test', '{"provider":"twitch"}',
   '{"nickname":"sw500smp","provider_id":"sw500-twitch-01"}'),
  ('f5000000-0000-4000-8000-000000000002', 'streamer@example.test', '{"provider":"twitch"}',
   '{"nickname":"sw500streamer","provider_id":"sw500-twitch-02"}'),
  ('f5000000-0000-4000-8000-000000000003', 'admin@example.test', '{"provider":"twitch"}',
   '{"nickname":"sw500admin","provider_id":"sw500-twitch-03"}');
INSERT INTO public.user_roles (user_id, role) VALUES
  ('f5000000-0000-4000-8000-000000000001', 'smp_admin'),
  ('f5000000-0000-4000-8000-000000000003', 'admin');

INSERT INTO public.overlay_templates (id, slug, name, is_published) VALUES
  ('f5000000-0000-4000-8000-0000000000a1', 'sw500-hidden', 'Hidden', false);
INSERT INTO public.overlay_template_items (template_id, type) VALUES
  ('f5000000-0000-4000-8000-0000000000a1', 'text');
INSERT INTO public.overlay_widget_templates (slug, name, is_published) VALUES
  ('sw500-hidden-widget', 'Hidden widget', false);

-- Visitors ------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT throws_ok('SELECT id FROM public.overlay_templates', '42501', NULL, 'anon cannot read templates');
SELECT throws_ok('SELECT id FROM public.overlay_widget_templates', '42501', NULL, 'anon cannot read widget templates');
SELECT throws_ok('SELECT id FROM public.user_roles', '42501', NULL, 'anon cannot read roles');
RESET ROLE;

-- A streamer reads published templates only ---------------------------------
SELECT set_config('request.jwt.claims',
  '{"sub":"f5000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
SET LOCAL ROLE authenticated;
SELECT isnt_empty('SELECT id FROM public.overlay_templates', 'streamer reads published templates');
SELECT isnt_empty('SELECT id FROM public.overlay_template_items', 'streamer reads items of published templates');
SELECT isnt_empty('SELECT id FROM public.overlay_widget_templates', 'streamer reads published widget templates');
SELECT is_empty($$SELECT id FROM public.overlay_templates WHERE NOT is_published$$, 'streamer cannot see unpublished templates');
SELECT is_empty(
  $$SELECT id FROM public.overlay_template_items WHERE template_id = 'f5000000-0000-4000-8000-0000000000a1'$$,
  'streamer cannot see items of unpublished templates');
SELECT is_empty('SELECT user_id FROM public.user_roles', 'streamer has no role rows to read');
RESET ROLE;

-- smp_admin with a plain session cannot write templates ---------------------
SELECT set_config('request.jwt.claims',
  '{"sub":"f5000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$INSERT INTO public.overlay_templates (slug, name) VALUES ('sw500-new', 'New')$$,
  '42501', NULL, 'smp_admin (aal1) cannot insert templates');
SELECT throws_ok($$UPDATE public.overlay_templates SET name = 'Changed'$$,
  '42501', NULL, 'smp_admin (aal1) cannot update templates');
SELECT throws_ok($$DELETE FROM public.overlay_template_items$$,
  '42501', NULL, 'smp_admin (aal1) cannot delete template items');
SELECT is_empty($$SELECT id FROM public.overlay_templates WHERE NOT is_published$$,
  'smp_admin sees no unpublished templates');
SELECT results_eq('SELECT user_id FROM public.user_roles',
  $$VALUES ('f5000000-0000-4000-8000-000000000001'::uuid)$$, 'smp_admin (aal1) reads only own role');
RESET ROLE;

-- Even a TOTP-verified smp_admin cannot write templates ---------------------
SELECT set_config('request.jwt.claims',
  '{"sub":"f5000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$INSERT INTO public.overlay_widget_templates (slug, name) VALUES ('sw500-new', 'New')$$,
  '42501', NULL, 'smp_admin (aal2) cannot insert widget templates');
SELECT throws_ok($$UPDATE public.overlay_widget_templates SET name = 'Changed'$$,
  '42501', NULL, 'smp_admin (aal2) cannot update widget templates');
SELECT ok(
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = 'f5000000-0000-4000-8000-000000000003'),
  'smp_admin (aal2) reads other users'' role rows');
SELECT throws_ok($$INSERT INTO public.user_roles (user_id, role) VALUES ('f5000000-0000-4000-8000-000000000002', 'admin')$$,
  '42501', NULL, 'smp_admin (aal2) cannot grant roles');
RESET ROLE;

-- The admin role alone does not unlock smp_admin's read ----------------------
SELECT set_config('request.jwt.claims',
  '{"sub":"f5000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}', true);
SET LOCAL ROLE authenticated;
SELECT results_eq('SELECT user_id FROM public.user_roles',
  $$VALUES ('f5000000-0000-4000-8000-000000000003'::uuid)$$, 'admin reads only own role row');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
