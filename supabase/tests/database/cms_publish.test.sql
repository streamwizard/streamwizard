-- Publishing, updating, unpublishing and trashing posts. Run: supabase test db --local
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(37);

INSERT INTO cms_assets (id, key, mime_type, size_bytes, width, height, alt, status) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'cms/2026/10/c/cover.png', 'image/png', 100, 1600, 900, 'Cover', 'ready'),
  ('a1000000-0000-4000-8000-000000000002', 'cms/2026/10/i/inline.png', 'image/png', 100, 800, 450, 'Inline', 'ready'),
  ('a1000000-0000-4000-8000-000000000003', 'cms/2026/10/p/pending.png', 'image/png', 100, 800, 450, 'Pending', 'pending');
INSERT INTO cms_authors (id, slug, name) VALUES
  ('b1000000-0000-4000-8000-000000000001', 'first', 'First'),
  ('b1000000-0000-4000-8000-000000000002', 'second', 'Second');
INSERT INTO cms_categories (id, slug, name) VALUES
  ('c1000000-0000-4000-8000-000000000001', 'obs', 'OBS'),
  ('c1000000-0000-4000-8000-000000000002', 'overlays', 'Overlays');
INSERT INTO cms_content (id, type, title, slug, body, body_text, cover_asset_id) VALUES (
  'e1000000-0000-4000-8000-000000000001', 'blog', 'First post', 'first-post',
  '{"type":"doc","content":[{"type":"image","attrs":{"assetId":"a1000000-0000-4000-8000-000000000002","alt":"Inline"}},{"type":"image","attrs":{"assetId":"a1000000-0000-4000-8000-000000000003","alt":"Pending"}}]}',
  'first words', 'a1000000-0000-4000-8000-000000000001'
);
-- Second author listed first on purpose: position decides the order.
INSERT INTO cms_content_authors (content_id, author_id, position) VALUES
  ('e1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 1),
  ('e1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 0);
INSERT INTO cms_content_categories (content_id, category_id) VALUES
  ('e1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001');

-- First publish -------------------------------------------------------------
CREATE TEMP TABLE r AS SELECT cms_publish('e1000000-0000-4000-8000-000000000001', NULL, 0, false) AS v;

SELECT is((SELECT v->'before' FROM r), 'null'::jsonb, 'first publish has no before');
SELECT is((SELECT v->>'first_publish' FROM r), 'true', 'first publish is flagged');
SELECT is((SELECT v->'after'->'author_ids' FROM r), '["b1000000-0000-4000-8000-000000000001","b1000000-0000-4000-8000-000000000002"]'::jsonb, 'authors in position order');
SELECT is((SELECT v->'after'->'category_ids' FROM r), '["c1000000-0000-4000-8000-000000000001"]'::jsonb, 'categories in the footprint');
SELECT is((SELECT (v->>'lock_version')::int FROM r), 1, 'lock version bumped');
SELECT is((SELECT status FROM cms_content WHERE id = 'e1000000-0000-4000-8000-000000000001'), 'published', 'status is published');
SELECT isnt((SELECT first_published_at FROM cms_content WHERE id = 'e1000000-0000-4000-8000-000000000001'), NULL, 'first_published_at set');
SELECT is((SELECT count(*)::int FROM cms_revisions WHERE content_id = 'e1000000-0000-4000-8000-000000000001' AND kind = 'publish'), 1, 'publish revision written');
SELECT is((SELECT title FROM cms_content_published WHERE content_id = 'e1000000-0000-4000-8000-000000000001'), 'First post', 'public copy written');
SELECT is((SELECT cover FROM cms_content_published WHERE content_id = 'e1000000-0000-4000-8000-000000000001'), '{"asset_id":"a1000000-0000-4000-8000-000000000001"}'::jsonb, 'cover points at its asset');
SELECT is(
  (SELECT array_agg(k ORDER BY k) FROM cms_content_published, jsonb_object_keys(assets) k WHERE content_id = 'e1000000-0000-4000-8000-000000000001'),
  ARRAY['a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002'],
  'assets resolve cover and inline images, not pending uploads'
);
SELECT is(
  (SELECT assets->'a1000000-0000-4000-8000-000000000002'->>'key' FROM cms_content_published WHERE content_id = 'e1000000-0000-4000-8000-000000000001'),
  'cms/2026/10/i/inline.png', 'assets carry the R2 key'
);
SELECT ok((SELECT search @@ to_tsquery('english', 'word') FROM cms_content_published WHERE content_id = 'e1000000-0000-4000-8000-000000000001'), 'body text is searchable');

-- Locking -------------------------------------------------------------------
SELECT throws_ok($$SELECT cms_publish('e1000000-0000-4000-8000-000000000001', NULL, 0, false)$$, 'P0001', 'cms_conflict', 'stale lock version is refused');
SELECT throws_ok($$SELECT cms_publish('e9999999-0000-4000-8000-000000000001', NULL, NULL, false)$$, 'P0001', 'cms_not_found', 'unknown post');

-- Update: slug change, category move, dates ---------------------------------
UPDATE cms_content_published SET content_updated_at = '2026-01-01', first_published_at = '2026-01-01'
  WHERE content_id = 'e1000000-0000-4000-8000-000000000001';
UPDATE cms_content SET slug = 'first-post-v2', first_published_at = '2026-01-01', content_updated_at = '2026-01-01'
  WHERE id = 'e1000000-0000-4000-8000-000000000001';
UPDATE cms_content_categories SET category_id = 'c1000000-0000-4000-8000-000000000002'
  WHERE content_id = 'e1000000-0000-4000-8000-000000000001';

TRUNCATE r;
INSERT INTO r SELECT cms_publish('e1000000-0000-4000-8000-000000000001', NULL, 1, true);

SELECT is((SELECT v->'before'->'category_ids' FROM r), '["c1000000-0000-4000-8000-000000000001"]'::jsonb, 'before has the old category');
SELECT is((SELECT v->'after'->'category_ids' FROM r), '["c1000000-0000-4000-8000-000000000002"]'::jsonb, 'after has the new category');
SELECT is((SELECT v->>'first_publish' FROM r), 'false', 'republish is not a first publish');
SELECT is((SELECT content_id FROM cms_slug_redirects WHERE type = 'blog' AND old_slug = 'first-post'), 'e1000000-0000-4000-8000-000000000001'::uuid, 'old slug redirects');
SELECT is((SELECT first_published_at FROM cms_content_published WHERE content_id = 'e1000000-0000-4000-8000-000000000001'), '2026-01-01'::timestamptz, 'published date never moves');
SELECT is((SELECT content_updated_at FROM cms_content_published WHERE content_id = 'e1000000-0000-4000-8000-000000000001'), '2026-01-01'::timestamptz, 'minor edit keeps the updated date');

SELECT cms_publish('e1000000-0000-4000-8000-000000000001', NULL, 2, false);
SELECT is((SELECT content_updated_at FROM cms_content_published WHERE content_id = 'e1000000-0000-4000-8000-000000000001'), now(), 'normal update bumps the updated date');

-- Going back to the old slug removes the redirect from it.
UPDATE cms_content SET slug = 'first-post' WHERE id = 'e1000000-0000-4000-8000-000000000001';
SELECT cms_publish('e1000000-0000-4000-8000-000000000001', NULL, NULL, false);
SELECT is((SELECT array_agg(old_slug) FROM cms_slug_redirects), ARRAY['first-post-v2'], 'live slug never redirects');

-- Validation ----------------------------------------------------------------
INSERT INTO cms_content (id, type, title, slug) VALUES ('e1000000-0000-4000-8000-000000000002', 'blog', 'No author', 'no-author');
SELECT throws_like($$SELECT cms_publish('e1000000-0000-4000-8000-000000000002', NULL, 0, false)$$, 'cms_invalid: at least one author%', 'needs an author');
UPDATE cms_content SET title = '  ' WHERE id = 'e1000000-0000-4000-8000-000000000002';
SELECT throws_like($$SELECT cms_publish('e1000000-0000-4000-8000-000000000002', NULL, 0, false)$$, 'cms_invalid: a title%', 'needs a title');
SELECT throws_ok($$INSERT INTO cms_content (type, slug, difficulty) VALUES ('blog', 'blog-with-difficulty', 'beginner')$$, '23514', NULL, 'guide fields only on guides');
SELECT throws_ok($$INSERT INTO cms_content (type, slug) VALUES ('blog', 'Bad Slug')$$, '23514', NULL, 'slug format enforced');
SELECT throws_ok($$INSERT INTO cms_content (type, slug, status) VALUES ('blog', 'no-date', 'scheduled')$$, '23514', NULL, 'scheduled needs a date');

-- Guides: sections in order, all text searchable -----------------------------
INSERT INTO cms_content (id, type, title, slug, body_text, difficulty) VALUES
  ('e1000000-0000-4000-8000-000000000003', 'guide', 'Set up OBS', 'set-up-obs', 'intro', 'beginner');
INSERT INTO cms_content_authors (content_id, author_id) VALUES ('e1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001');
INSERT INTO cms_guide_sections (content_id, position, title, anchor, body_text) VALUES
  ('e1000000-0000-4000-8000-000000000003', 1, 'Second', 'second', 'scenes'),
  ('e1000000-0000-4000-8000-000000000003', 0, 'First', 'first', 'install');
SELECT cms_publish('e1000000-0000-4000-8000-000000000003', NULL, 0, false);
SELECT is((SELECT jsonb_path_query_array(sections, '$[*].anchor') FROM cms_content_published WHERE content_id = 'e1000000-0000-4000-8000-000000000003'), '["first","second"]'::jsonb, 'sections in position order');
SELECT ok((SELECT search @@ to_tsquery('english', 'scenes') FROM cms_content_published WHERE content_id = 'e1000000-0000-4000-8000-000000000003'), 'section text is searchable');

-- Unpublish and trash -------------------------------------------------------
SELECT throws_like($$SELECT cms_unpublish('e1000000-0000-4000-8000-000000000002', NULL, NULL, 'draft')$$, 'cms_invalid: a draft post%', 'cannot unpublish a draft');
SELECT is(
  (SELECT cms_unpublish('e1000000-0000-4000-8000-000000000003', NULL, NULL, 'archived')->'before'->>'type'),
  'guide', 'unpublish returns what was public'
);
SELECT is((SELECT status FROM cms_content WHERE id = 'e1000000-0000-4000-8000-000000000003'), 'archived', 'archived');

INSERT INTO cms_preview_tokens (content_id, token_hash, expires_at) VALUES
  ('e1000000-0000-4000-8000-000000000001', sha256('token'::bytea), now() + interval '1 day');
SELECT isnt((SELECT cms_trash('e1000000-0000-4000-8000-000000000001', NULL, NULL)->'before'), 'null'::jsonb, 'trashing a live post returns what was public');
SELECT is_empty($$SELECT 1 FROM cms_content_published WHERE content_id = 'e1000000-0000-4000-8000-000000000001'$$, 'trash takes it off the site');
SELECT is((SELECT count(*)::int FROM cms_preview_tokens WHERE revoked_at IS NULL), 0, 'trash revokes preview links');
SELECT throws_ok($$SELECT cms_publish('e1000000-0000-4000-8000-000000000001', NULL, NULL, false)$$, 'P0001', 'cms_not_found', 'a trashed post cannot be published');

SELECT * FROM finish();
ROLLBACK;
