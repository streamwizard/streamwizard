-- Overlay scenes, items, groups, custom widgets and widget instances belong to
-- the scene owner (20261028131000, 20261028130600, 20261026120000).
-- Run: supabase test db --local
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(26);

-- Fixtures (as postgres): A owns a scene with an item, a group, a custom widget
-- and that widget's instance on the item. B owns a scene with one item.
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('50900000-0000-4000-8000-0000000003a1', 'sw509-ov-a@test.local', '{"provider":"email"}', '{}'),
  ('50900000-0000-4000-8000-0000000003b1', 'sw509-ov-b@test.local', '{"provider":"email"}', '{}');
INSERT INTO public.overlay_scenes (id, user_id, name, slug) VALUES
  ('50900000-0000-4000-8000-0000000003a2', '50900000-0000-4000-8000-0000000003a1', 'A scene', 'sw509-a-aaaaaaaaaaaaaaaa'),
  ('50900000-0000-4000-8000-0000000003b2', '50900000-0000-4000-8000-0000000003b1', 'B scene', 'sw509-b-bbbbbbbbbbbbbbbb');
INSERT INTO public.overlay_item_groups (id, scene_id, label) VALUES
  ('50900000-0000-4000-8000-0000000003a4', '50900000-0000-4000-8000-0000000003a2', 'A group');
INSERT INTO public.overlay_items (id, scene_id, label, group_id) VALUES
  ('50900000-0000-4000-8000-0000000003a3', '50900000-0000-4000-8000-0000000003a2', 'A item', '50900000-0000-4000-8000-0000000003a4'),
  ('50900000-0000-4000-8000-0000000003b3', '50900000-0000-4000-8000-0000000003b2', 'B item', NULL);
INSERT INTO public.overlay_widgets (id, user_id, name) VALUES
  ('50900000-0000-4000-8000-0000000003a5', '50900000-0000-4000-8000-0000000003a1', 'A widget'),
  ('50900000-0000-4000-8000-0000000003b5', '50900000-0000-4000-8000-0000000003b1', 'B widget');
INSERT INTO public.overlay_widget_instances (id, overlay_item_id, widget_id, user_id) VALUES
  ('50900000-0000-4000-8000-0000000003a6', '50900000-0000-4000-8000-0000000003a3', '50900000-0000-4000-8000-0000000003a5', '50900000-0000-4000-8000-0000000003a1');

-- Owner ------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000003a1","role":"authenticated","aal":"aal1"}';

SELECT results_eq('SELECT name FROM public.overlay_scenes', ARRAY['A scene'], 'the owner reads only their own scenes');
SELECT results_eq('SELECT label FROM public.overlay_items', ARRAY['A item'], 'the owner reads only their own items');
SELECT results_eq('SELECT label FROM public.overlay_item_groups', ARRAY['A group'], 'the owner reads their groups');
SELECT results_eq('SELECT name FROM public.overlay_widgets', ARRAY['A widget'], 'the owner reads only their own widgets');
SELECT results_eq(
  $$WITH u AS (UPDATE public.overlay_widget_instances SET field_values = '{"x":1}' RETURNING id) SELECT count(*)::int FROM u$$,
  ARRAY[1], 'the owner edits their widget instance');
SELECT throws_ok(
  $$UPDATE public.overlay_widget_instances SET overlay_item_id = '50900000-0000-4000-8000-0000000003b3'$$,
  '42501', NULL, 'the owner cannot move their instance onto someone else''s item');

-- Another signed-in user -------------------------------------------------------
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000003b1","role":"authenticated","aal":"aal1"}';

SELECT is_empty($$SELECT 1 FROM public.overlay_scenes WHERE id = '50900000-0000-4000-8000-0000000003a2'$$,
  'another user cannot read the scene (or its subscriber_token)');
SELECT is_empty($$SELECT 1 FROM public.overlay_items WHERE id = '50900000-0000-4000-8000-0000000003a3'$$,
  'another user cannot read the items');
SELECT is_empty($$SELECT 1 FROM public.overlay_item_groups WHERE id = '50900000-0000-4000-8000-0000000003a4'$$,
  'another user cannot read the groups');
SELECT is_empty($$SELECT 1 FROM public.overlay_widgets WHERE id = '50900000-0000-4000-8000-0000000003a5'$$,
  'another user cannot read the custom widget');
SELECT is_empty($$SELECT 1 FROM public.overlay_widget_instances WHERE id = '50900000-0000-4000-8000-0000000003a6'$$,
  'another user cannot read the widget instance');
SELECT is_empty(
  $$WITH u AS (UPDATE public.overlay_scenes SET name = 'taken' WHERE id = '50900000-0000-4000-8000-0000000003a2' RETURNING 1) SELECT * FROM u$$,
  'another user cannot rename the scene');
SELECT is_empty(
  $$WITH d AS (DELETE FROM public.overlay_items WHERE id = '50900000-0000-4000-8000-0000000003a3' RETURNING 1) SELECT * FROM d$$,
  'another user cannot delete the items');
SELECT is_empty(
  $$WITH u AS (UPDATE public.overlay_widgets SET html = 'x' WHERE id = '50900000-0000-4000-8000-0000000003a5' RETURNING 1) SELECT * FROM u$$,
  'another user cannot edit the custom widget');
SELECT throws_ok(
  $$INSERT INTO public.overlay_items (scene_id, label) VALUES ('50900000-0000-4000-8000-0000000003a2', 'intruder')$$,
  '42501', NULL, 'another user cannot add items to the scene');
SELECT throws_ok(
  $$INSERT INTO public.overlay_item_groups (id, scene_id, label) VALUES (gen_random_uuid(), '50900000-0000-4000-8000-0000000003a2', 'intruder')$$,
  '42501', NULL, 'another user cannot add groups to the scene');
SELECT throws_ok(
  $$INSERT INTO public.overlay_widget_instances (overlay_item_id, widget_id, user_id)
    VALUES ('50900000-0000-4000-8000-0000000003a3', '50900000-0000-4000-8000-0000000003b5', '50900000-0000-4000-8000-0000000003b1')$$,
  '42501', NULL, 'a widget instance cannot be bound to another user''s item, even with your own user_id');
SELECT lives_ok(
  $$INSERT INTO public.overlay_widget_instances (overlay_item_id, widget_id, user_id)
    VALUES ('50900000-0000-4000-8000-0000000003b3', '50900000-0000-4000-8000-0000000003b5', '50900000-0000-4000-8000-0000000003b1')$$,
  'a widget instance on your own item is fine');
SELECT throws_ok(
  $$INSERT INTO public.overlay_widget_instances (overlay_item_id, widget_id, user_id)
    VALUES ('50900000-0000-4000-8000-0000000003b3', '50900000-0000-4000-8000-0000000003b5', '50900000-0000-4000-8000-0000000003b1')$$,
  '23505', NULL, 'an item has at most one widget instance');
SELECT throws_ok(
  $$INSERT INTO public.overlay_scenes (user_id, name, slug) VALUES ('50900000-0000-4000-8000-0000000003b1', 'copy', 'sw509-a-aaaaaaaaaaaaaaaa')$$,
  '23505', NULL, 'another user cannot take an existing overlay slug');
RESET ROLE;

-- Visitors ---------------------------------------------------------------------
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" TO '{"role":"anon"}';
SELECT throws_ok('SELECT 1 FROM public.overlay_scenes', '42501', NULL, 'anon cannot read scenes');
SELECT throws_ok('SELECT 1 FROM public.overlay_items', '42501', NULL, 'anon cannot read items');
SELECT throws_ok('SELECT 1 FROM public.overlay_widget_instances', '42501', NULL, 'anon cannot read widget instances');
-- The group policy reads overlay_scenes, which anon has no grant on.
SELECT throws_ok('SELECT 1 FROM public.overlay_item_groups', '42501', NULL, 'anon cannot read groups');
SELECT is_empty('SELECT 1 FROM public.overlay_widgets', 'anon reads no custom widgets');
SELECT throws_ok(
  $$INSERT INTO public.overlay_widgets (user_id, name) VALUES ('50900000-0000-4000-8000-0000000003a1', 'anon')$$,
  '42501', NULL, 'anon cannot create widgets');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
