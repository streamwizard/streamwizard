-- The scheduler's claim and the unused-image sweep. Run: supabase test db --local
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(14);

INSERT INTO cms_authors (id, slug, name) VALUES ('b2000000-0000-4000-8000-000000000001', 'writer', 'Writer');
INSERT INTO cms_content (id, type, title, slug, status, publish_at) VALUES
  ('e2000000-0000-4000-8000-000000000001', 'blog', 'Due', 'due', 'scheduled', now() - interval '1 minute'),
  ('e2000000-0000-4000-8000-000000000002', 'blog', 'Later', 'later', 'scheduled', now() + interval '1 day'),
  ('e2000000-0000-4000-8000-000000000003', 'blog', 'Due without author', 'due-without-author', 'scheduled', now() - interval '2 minutes');
INSERT INTO cms_content_authors (content_id, author_id) VALUES
  ('e2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001'),
  ('e2000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001');

-- Scheduler -----------------------------------------------------------------
CREATE TEMP TABLE claimed AS SELECT * FROM cms_claim_due_scheduled(20);

SELECT is((SELECT count(*)::int FROM claimed), 2, 'both due posts handled, the future one not');
SELECT is((SELECT ok FROM claimed WHERE content_id = 'e2000000-0000-4000-8000-000000000001'), true, 'due post published');
SELECT is((SELECT status FROM cms_content WHERE id = 'e2000000-0000-4000-8000-000000000001'), 'published', 'status flipped');
SELECT isnt((SELECT result->'after' FROM claimed WHERE content_id = 'e2000000-0000-4000-8000-000000000001'), NULL, 'result carries the footprint');
SELECT is((SELECT ok FROM claimed WHERE content_id = 'e2000000-0000-4000-8000-000000000003'), false, 'broken post reported');
SELECT is((SELECT status FROM cms_content WHERE id = 'e2000000-0000-4000-8000-000000000003'), 'draft', 'broken post back to draft');
SELECT matches((SELECT schedule_error FROM cms_content WHERE id = 'e2000000-0000-4000-8000-000000000003'), '^cms_invalid: at least one author', 'and says why');
SELECT is((SELECT status FROM cms_content WHERE id = 'e2000000-0000-4000-8000-000000000002'), 'scheduled', 'future post untouched');
SELECT is_empty('SELECT * FROM cms_claim_due_scheduled(20)', 'a second tick finds nothing');

-- Asset ids in JSON -----------------------------------------------------------
SELECT results_eq(
  $$SELECT x::text FROM cms_jsonb_asset_ids('{"type":"doc","content":[{"type":"blockquote","content":[{"type":"image","attrs":{"assetId":"a2000000-0000-4000-8000-000000000001"}}]},{"type":"image","attrs":{"assetId":"not-a-uuid"}}],"cover_asset_id":"a2000000-0000-4000-8000-000000000002"}'::jsonb) x ORDER BY 1$$,
  ARRAY['a2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002'],
  'finds nested and snapshot ids, skips junk'
);

-- Unused images ---------------------------------------------------------------
INSERT INTO cms_assets (id, key, mime_type, size_bytes, status, created_at) VALUES
  ('a2000000-0000-4000-8000-000000000011', 'cms/old/cover.png', 'image/png', 1, 'ready', now() - interval '30 days'),
  ('a2000000-0000-4000-8000-000000000012', 'cms/old/inline.png', 'image/png', 1, 'ready', now() - interval '30 days'),
  ('a2000000-0000-4000-8000-000000000013', 'cms/old/avatar.png', 'image/png', 1, 'ready', now() - interval '30 days'),
  ('a2000000-0000-4000-8000-000000000014', 'cms/old/in-revision.png', 'image/png', 1, 'ready', now() - interval '30 days'),
  ('a2000000-0000-4000-8000-000000000015', 'cms/old/unused.png', 'image/png', 1, 'ready', now() - interval '30 days'),
  ('a2000000-0000-4000-8000-000000000016', 'cms/new/unused.png', 'image/png', 1, 'ready', now()),
  ('a2000000-0000-4000-8000-000000000017', 'cms/old/pending.png', 'image/png', 1, 'pending', now() - interval '30 days');
UPDATE cms_content SET
  cover_asset_id = 'a2000000-0000-4000-8000-000000000011',
  body = '{"type":"doc","content":[{"type":"image","attrs":{"assetId":"a2000000-0000-4000-8000-000000000012"}}]}'
WHERE id = 'e2000000-0000-4000-8000-000000000002';
UPDATE cms_authors SET avatar_asset_id = 'a2000000-0000-4000-8000-000000000013' WHERE id = 'b2000000-0000-4000-8000-000000000001';
INSERT INTO cms_revisions (content_id, kind, snapshot) VALUES (
  'e2000000-0000-4000-8000-000000000002', 'manual',
  '{"body":{"type":"doc","content":[{"type":"image","attrs":{"assetId":"a2000000-0000-4000-8000-000000000014"}}]}}'
);

SELECT results_eq(
  $$SELECT key FROM cms_unreferenced_assets(interval '7 days')$$,
  ARRAY['cms/old/unused.png'],
  'only the old, unused, ready image'
);

-- The asset key has to live under cms/, and SVG is refused.
SELECT throws_ok($$INSERT INTO cms_assets (key, mime_type, size_bytes) VALUES ('assets/x.png', 'image/png', 1)$$, '23514', NULL, 'key must be under cms/');
SELECT throws_ok($$INSERT INTO cms_assets (key, mime_type, size_bytes) VALUES ('cms/x.svg', 'image/svg+xml', 1)$$, '23514', NULL, 'no SVG');
SELECT throws_ok(
  $$DELETE FROM cms_authors WHERE id = 'b2000000-0000-4000-8000-000000000001'$$,
  '23503', NULL, 'a credited author cannot be hard-deleted'
);

SELECT * FROM finish();
ROLLBACK;
