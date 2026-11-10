-- Clip folders, folder entries, clips and the clip sync state belong to their
-- user; the sync row is read-only for users (20261030150000).
-- Run: supabase test db --local
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(22);

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('50900000-0000-4000-8000-0000000005a1', 'sw509-clips-a@test.local', '{"provider":"email"}', '{}'),
  ('50900000-0000-4000-8000-0000000005b1', 'sw509-clips-b@test.local', '{"provider":"email"}', '{}');
INSERT INTO public.twitch_clip_syncs (user_id, last_sync, clip_count, sync_status) VALUES
  ('50900000-0000-4000-8000-0000000005a1', now() - interval '2 hours', 3, 'completed');
INSERT INTO public.clip_folders (id, user_id, name, href) VALUES
  ('50900000-0000-4000-8000-0000000005a2', '50900000-0000-4000-8000-0000000005a1', 'A folder', 'a-folder'),
  ('50900000-0000-4000-8000-0000000005b2', '50900000-0000-4000-8000-0000000005b1', 'B folder', 'b-folder');
INSERT INTO public.clips (twitch_clip_id, title, creator_name, url, broadcaster_name, created_at_twitch, user_id, broadcaster_id, creator_id) VALUES
  ('sw509-clip-a', 'A clip', 'a', 'https://clips.test/a', 'a', now(), '50900000-0000-4000-8000-0000000005a1', '9509000501', '9509000501');
INSERT INTO public.clip_folder_junction (clip_id, user_id, folder_id) VALUES
  ('sw509-clip-a', '50900000-0000-4000-8000-0000000005a1', '50900000-0000-4000-8000-0000000005a2');

-- Owner ------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000005a1","role":"authenticated","aal":"aal1"}';

SELECT results_eq('SELECT clip_count FROM public.twitch_clip_syncs', ARRAY[3], 'the owner reads their sync state');
SELECT throws_ok($$UPDATE public.twitch_clip_syncs SET last_sync = now() - interval '1 day', sync_status = 'failed'$$,
  '42501', NULL, 'the owner cannot reset the sync cooldown');
SELECT throws_ok($$DELETE FROM public.twitch_clip_syncs$$,
  '42501', NULL, 'the owner cannot delete the sync row');
SELECT throws_ok(
  $$INSERT INTO public.twitch_clip_syncs (user_id, last_sync, clip_count, sync_status) VALUES ('50900000-0000-4000-8000-0000000005a1', now(), 0, 'syncing')$$,
  '42501', NULL, 'the owner cannot write a sync row');
SELECT results_eq('SELECT name FROM public.clip_folders', ARRAY['A folder'], 'the owner reads only their own folders');
SELECT results_eq('SELECT clip_id FROM public.clip_folder_junction', ARRAY['sw509-clip-a'], 'the owner reads their folder entries');

-- Another signed-in user -------------------------------------------------------
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000005b1","role":"authenticated","aal":"aal1"}';

SELECT is_empty('SELECT 1 FROM public.twitch_clip_syncs', 'another user cannot read the sync state');
SELECT is_empty($$SELECT 1 FROM public.clip_folders WHERE id = '50900000-0000-4000-8000-0000000005a2'$$,
  'another user cannot read the folder');
SELECT is_empty(
  $$WITH u AS (UPDATE public.clip_folders SET name = 'mine now' WHERE id = '50900000-0000-4000-8000-0000000005a2' RETURNING 1) SELECT * FROM u$$,
  'another user cannot rename the folder');
SELECT is_empty(
  $$WITH d AS (DELETE FROM public.clip_folders WHERE id = '50900000-0000-4000-8000-0000000005a2' RETURNING 1) SELECT * FROM d$$,
  'another user cannot delete the folder');
SELECT throws_ok(
  $$INSERT INTO public.clip_folders (user_id, name, href) VALUES ('50900000-0000-4000-8000-0000000005a1', 'planted', 'planted')$$,
  '42501', NULL, 'another user cannot create a folder in A''s name');
SELECT is_empty('SELECT 1 FROM public.clip_folder_junction', 'another user cannot read the folder entries');
SELECT throws_ok(
  $$INSERT INTO public.clip_folder_junction (clip_id, user_id, folder_id) VALUES ('sw509-clip-a', '50900000-0000-4000-8000-0000000005b1', '50900000-0000-4000-8000-0000000005a2')$$,
  '42501', NULL, 'another user cannot file clips into A''s folder');
SELECT lives_ok(
  $$INSERT INTO public.clip_folder_junction (clip_id, user_id, folder_id) VALUES ('sw509-clip-a', '50900000-0000-4000-8000-0000000005b1', '50900000-0000-4000-8000-0000000005b2')$$,
  'a user files a visible clip into their own folder');
SELECT is_empty(
  $$WITH d AS (DELETE FROM public.clip_folder_junction WHERE user_id = '50900000-0000-4000-8000-0000000005a1' RETURNING 1) SELECT * FROM d$$,
  'another user cannot remove A''s folder entries');
SELECT results_eq($$SELECT title FROM public.clips WHERE twitch_clip_id = 'sw509-clip-a'$$,
  ARRAY['A clip'], 'clips are readable by everyone');
SELECT is_empty(
  $$WITH u AS (UPDATE public.clips SET title = 'defaced' WHERE twitch_clip_id = 'sw509-clip-a' RETURNING 1) SELECT * FROM u$$,
  'another user cannot edit the clip');
SELECT is_empty(
  $$WITH d AS (DELETE FROM public.clips WHERE twitch_clip_id = 'sw509-clip-a' RETURNING 1) SELECT * FROM d$$,
  'another user cannot delete the clip');
SELECT throws_ok(
  $$INSERT INTO public.clips (twitch_clip_id, title, creator_name, url, broadcaster_name, created_at_twitch, user_id, broadcaster_id, creator_id)
    VALUES ('sw509-clip-planted', 'x', 'x', 'https://clips.test/x', 'x', now(), '50900000-0000-4000-8000-0000000005a1', '1', '1')$$,
  '42501', NULL, 'another user cannot insert clips in A''s name');
RESET ROLE;

-- Visitors ---------------------------------------------------------------------
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" TO '{"role":"anon"}';
SELECT is_empty('SELECT 1 FROM public.twitch_clip_syncs', 'anon reads no sync state');
SELECT is_empty('SELECT 1 FROM public.clip_folders', 'anon reads no folders');
SELECT throws_ok($$UPDATE public.twitch_clip_syncs SET clip_count = 0$$,
  '42501', NULL, 'anon cannot write sync state');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
