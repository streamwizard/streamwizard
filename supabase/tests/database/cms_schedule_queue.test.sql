-- Scheduling from web-admin and the revalidate retry queue. Run: supabase test db --local
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(18);

INSERT INTO cms_content (id, type, title, slug, status) VALUES
  ('e5000000-0000-4000-8000-000000000001', 'blog', 'Draft', 'sched-draft', 'draft'),
  ('e5000000-0000-4000-8000-000000000002', 'blog', 'Archived', 'sched-archived', 'archived');

-- Schedule ---------------------------------------------------------------------
SELECT is(
  (cms_schedule('e5000000-0000-4000-8000-000000000001', NULL, 0, now() + interval '1 day')->>'lock_version')::int,
  1, 'scheduling bumps the lock version'
);
SELECT is((SELECT status FROM cms_content WHERE id = 'e5000000-0000-4000-8000-000000000001'), 'scheduled', 'the draft is scheduled');
SELECT ok((SELECT publish_at > now() FROM cms_content WHERE id = 'e5000000-0000-4000-8000-000000000001'), 'publish_at is stored');

UPDATE cms_content SET schedule_error = 'old failure' WHERE id = 'e5000000-0000-4000-8000-000000000001';
SELECT lives_ok(
  $$ SELECT cms_schedule('e5000000-0000-4000-8000-000000000001', NULL, 1, now() + interval '2 days') $$,
  'a scheduled post can move to a new time'
);
SELECT is((SELECT schedule_error FROM cms_content WHERE id = 'e5000000-0000-4000-8000-000000000001'), NULL, 'rescheduling clears the last failure');

SELECT throws_like(
  $$ SELECT cms_schedule('e5000000-0000-4000-8000-000000000001', NULL, 2, now() - interval '1 minute') $$,
  'cms_invalid: the publish time has to be in the future', 'a time in the past is refused'
);
SELECT throws_like(
  $$ SELECT cms_schedule('e5000000-0000-4000-8000-000000000002', NULL, 0, now() + interval '1 day') $$,
  'cms_invalid: a archived post can''t be scheduled', 'archived posts are not scheduled'
);
SELECT throws_like(
  $$ SELECT cms_schedule('e5000000-0000-4000-8000-000000000001', NULL, 0, now() + interval '1 day') $$,
  'cms_conflict', 'a stale lock version is a conflict'
);

-- Unschedule -------------------------------------------------------------------
SELECT is(
  (cms_unschedule('e5000000-0000-4000-8000-000000000001', NULL, 2)->>'lock_version')::int,
  3, 'unscheduling bumps the lock version'
);
SELECT is(
  (SELECT row(status, publish_at, scheduled_by)::text FROM cms_content WHERE id = 'e5000000-0000-4000-8000-000000000001'),
  '(draft,,)', 'back to a draft with no schedule'
);
SELECT throws_like(
  $$ SELECT cms_unschedule('e5000000-0000-4000-8000-000000000001', NULL, 3) $$,
  'cms_invalid: a draft post isn''t scheduled', 'only scheduled posts can be unscheduled'
);

-- Retry queue ------------------------------------------------------------------
SELECT hasnt_column('public', 'cms_content', 'revalidate_tags', 'tags no longer park on the post');
INSERT INTO cms_revalidate_queue (tags, next_attempt_at) VALUES
  (ARRAY['cms:list:blog'], now() - interval '2 minutes'),
  (ARRAY['cms:sitemap'], now() - interval '1 minute'),
  (ARRAY['cms:taxonomy'], now() + interval '1 hour');

CREATE TEMP TABLE first_claim AS SELECT * FROM cms_claim_revalidations(1, 60);
SELECT is((SELECT tags FROM first_claim), ARRAY['cms:list:blog'], 'the oldest due row first');
SELECT is((SELECT attempts FROM first_claim), 1, 'claiming counts an attempt');
SELECT ok((SELECT next_attempt_at > now() + interval '50 seconds' FROM first_claim), 'a claimed row is leased');
SELECT is((SELECT array_agg(tags[1]) FROM cms_claim_revalidations(10, 60)), ARRAY['cms:sitemap'], 'leased and future rows are skipped');
SELECT is_empty('SELECT * FROM cms_claim_revalidations(10, 60)', 'nothing left that is due');

SET LOCAL ROLE anon;
SELECT throws_like('SELECT * FROM cms_revalidate_queue', '%permission denied%', 'anon can''t read the queue');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
