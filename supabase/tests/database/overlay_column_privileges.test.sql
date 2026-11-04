-- Columns owners must not write themselves: an overlay's slug and
-- subscriber_token (20261030120000), and a library entry's moderation and
-- ranking columns (20261028130700).
-- Run: supabase test db --local
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(19);

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('50900000-0000-4000-8000-0000000004a1', 'sw509-cols-a@test.local', '{"provider":"email"}', '{}');
INSERT INTO public.overlay_scenes (id, user_id, name, slug) VALUES
  ('50900000-0000-4000-8000-0000000004a2', '50900000-0000-4000-8000-0000000004a1', 'Mine', 'sw509-cols-aaaaaaaaaaaaaaaa');
INSERT INTO public.overlay_widgets (id, user_id, name) VALUES
  ('50900000-0000-4000-8000-0000000004a5', '50900000-0000-4000-8000-0000000004a1', 'Mine');
INSERT INTO public.overlay_widget_library_entries (id, widget_id, user_id, title, is_approved) VALUES
  ('50900000-0000-4000-8000-0000000004a6', '50900000-0000-4000-8000-0000000004a5', '50900000-0000-4000-8000-0000000004a1', 'Approved', true);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000004a1","role":"authenticated","aal":"aal1"}';

-- Overlay scenes -----------------------------------------------------------------
SELECT results_eq(
  $$WITH u AS (UPDATE public.overlay_scenes SET name = 'Renamed', is_favourite = true RETURNING name) SELECT name FROM u$$,
  ARRAY['Renamed'], 'the owner edits name and editor columns');
SELECT throws_ok($$UPDATE public.overlay_scenes SET slug = 'someone-elses-slug'$$,
  '42501', NULL, 'the owner cannot change the slug directly');
SELECT throws_ok($$UPDATE public.overlay_scenes SET subscriber_token = 'chosen'$$,
  '42501', NULL, 'the owner cannot set the subscriber token');
SELECT throws_ok($$UPDATE public.overlay_scenes SET user_id = gen_random_uuid()$$,
  '42501', NULL, 'the owner cannot hand the scene to another user');
SELECT throws_ok($$UPDATE public.overlay_scenes SET render_mode = 'gps'$$,
  '42501', NULL, 'render_mode is fixed after creation');
SELECT throws_ok(
  $$INSERT INTO public.overlay_scenes (user_id, name, slug, subscriber_token)
    VALUES ('50900000-0000-4000-8000-0000000004a1', 'x', 'sw509-new-bbbbbbbbbbbbbbbb', 'chosen')$$,
  '42501', NULL, 'a new scene cannot pick its own subscriber token');
SELECT throws_ok(
  $$INSERT INTO public.overlay_scenes (user_id, name, slug) VALUES ('50900000-0000-4000-8000-0000000004a1', 'x', 'my-vanity-slug')$$,
  '23514', NULL, 'a new slug needs the random suffix');
SELECT lives_ok(
  $$INSERT INTO public.overlay_scenes (user_id, name, slug) VALUES ('50900000-0000-4000-8000-0000000004a1', 'x', 'sw509-new-cccccccccccccccc')$$,
  'a new scene with a random-suffix slug is created');
SELECT isnt(
  (SELECT subscriber_token FROM public.overlay_scenes WHERE slug = 'sw509-new-cccccccccccccccc'), NULL,
  'the new scene gets a generated subscriber token');
SELECT throws_ok(
  $$INSERT INTO public.overlay_scenes (user_id, name, slug) VALUES (gen_random_uuid(), 'x', 'sw509-new-dddddddddddddddd')$$,
  '42501', NULL, 'a scene cannot be created for another user');

-- Widget library entries -------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.overlay_widget_library_entries (widget_id, user_id, title, is_approved)
    VALUES ('50900000-0000-4000-8000-0000000004a5', '50900000-0000-4000-8000-0000000004a1', 'Self-approved', true)$$,
  '42501', NULL, 'an owner cannot publish pre-approved');
SELECT throws_ok(
  $$INSERT INTO public.overlay_widget_library_entries (widget_id, user_id, title, likes)
    VALUES ('50900000-0000-4000-8000-0000000004a5', '50900000-0000-4000-8000-0000000004a1', 'Popular', 9999)$$,
  '42501', NULL, 'an owner cannot seed their own likes');
SELECT lives_ok(
  $$INSERT INTO public.overlay_widget_library_entries (widget_id, user_id, title)
    VALUES ('50900000-0000-4000-8000-0000000004a5', '50900000-0000-4000-8000-0000000004a1', 'Pending')$$,
  'an owner publishes with the content columns');
SELECT results_eq($$SELECT is_approved FROM public.overlay_widget_library_entries WHERE title = 'Pending'$$,
  ARRAY[false], 'a new entry waits for moderation');
SELECT throws_ok($$UPDATE public.overlay_widget_library_entries SET is_approved = true$$,
  '42501', NULL, 'an owner cannot approve their own entry');
SELECT throws_ok($$UPDATE public.overlay_widget_library_entries SET installs = installs + 100$$,
  '42501', NULL, 'an owner cannot raise their install count');
SELECT lives_ok(
  $$UPDATE public.overlay_widget_library_entries SET title = 'Approved, edited' WHERE id = '50900000-0000-4000-8000-0000000004a6'$$,
  'an owner edits the public content of an approved entry');
RESET ROLE;
SELECT results_eq($$SELECT is_approved FROM public.overlay_widget_library_entries WHERE id = '50900000-0000-4000-8000-0000000004a6'$$,
  ARRAY[false], 'editing an approved entry sends it back to moderation');

-- Visitors ---------------------------------------------------------------------
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" TO '{"role":"anon"}';
SELECT throws_ok(
  $$INSERT INTO public.overlay_widget_library_entries (widget_id, user_id, title)
    VALUES ('50900000-0000-4000-8000-0000000004a5', '50900000-0000-4000-8000-0000000004a1', 'anon')$$,
  '42501', NULL, 'anon cannot publish library entries');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
