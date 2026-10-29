-- Who can read what in the CMS tables. Run: supabase test db --local
-- Everything happens inside one transaction that is rolled back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(19);

-- Fixtures (as postgres).
INSERT INTO cms_assets (id, key, mime_type, size_bytes, width, height, alt, status) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'cms/2026/10/a1/avatar.png', 'image/png', 100, 64, 64, 'Jochem', 'ready'),
  ('a0000000-0000-4000-8000-000000000002', 'cms/2026/10/a2/draft-shot.png', 'image/png', 100, 800, 450, 'Unreleased', 'ready');
INSERT INTO cms_authors (id, slug, name, avatar_asset_id) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'jochem', 'Jochem', 'a0000000-0000-4000-8000-000000000001');
INSERT INTO cms_authors (id, slug, name, deleted_at) VALUES
  ('b0000000-0000-4000-8000-000000000002', 'gone', 'Gone', now());
INSERT INTO cms_categories (id, slug, name) VALUES ('c0000000-0000-4000-8000-000000000001', 'obs', 'OBS');
INSERT INTO cms_tags (id, slug, name) VALUES ('d0000000-0000-4000-8000-000000000001', 'alerts', 'Alerts');
INSERT INTO cms_content (id, type, title, slug, body_text) VALUES
  ('e0000000-0000-4000-8000-000000000001', 'guide', 'Live post', 'live-post', 'hello'),
  ('e0000000-0000-4000-8000-000000000002', 'blog', 'Secret draft', 'secret-draft', 'not yet');
INSERT INTO cms_content_authors (content_id, author_id) VALUES
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
SELECT cms_publish('e0000000-0000-4000-8000-000000000001', NULL, 0, false);
-- Rename it, so it has an old URL.
UPDATE cms_content SET slug = 'live-post-renamed' WHERE id = 'e0000000-0000-4000-8000-000000000001';
SELECT cms_publish('e0000000-0000-4000-8000-000000000001', NULL, NULL, false);

-- Visitors ------------------------------------------------------------------
SET LOCAL ROLE anon;

SELECT throws_ok('SELECT id FROM cms_content', '42501', NULL, 'anon cannot read working copies');
SELECT throws_ok('SELECT id FROM cms_revisions', '42501', NULL, 'anon cannot read revisions');
SELECT throws_ok('SELECT id FROM cms_preview_tokens', '42501', NULL, 'anon cannot read preview tokens');
SELECT throws_ok('SELECT id FROM cms_guide_sections', '42501', NULL, 'anon cannot read draft sections');
SELECT throws_ok('SELECT content_id FROM cms_content_authors', '42501', NULL, 'anon cannot read draft credits');

SELECT results_eq('SELECT slug FROM cms_content_published', ARRAY['live-post-renamed'], 'anon reads published posts only');
SELECT results_eq('SELECT slug FROM cms_authors', ARRAY['jochem'], 'anon reads live authors only');
SELECT throws_ok('SELECT user_id FROM cms_authors', '42501', NULL, 'anon cannot see which account an author is');
SELECT results_eq('SELECT key FROM cms_assets', ARRAY['cms/2026/10/a1/avatar.png'], 'anon sees avatars, not draft images');
SELECT results_eq('SELECT slug FROM cms_categories', ARRAY['obs'], 'anon reads categories');
SELECT results_eq('SELECT old_slug FROM cms_slug_redirects', ARRAY['live-post'], 'anon reads redirects of published posts');

SELECT throws_ok(
  $$INSERT INTO cms_content_published (content_id, type, slug, title, body, word_count, reading_time_minutes, noindex, is_featured, comments_enabled, first_published_at, content_updated_at)
    VALUES ('e0000000-0000-4000-8000-000000000002', 'blog', 'x', 'x', '{}', 0, 1, false, false, true, now(), now())$$,
  '42501', NULL, 'anon cannot write the public copy');
SELECT throws_ok($$UPDATE cms_categories SET name = 'Hacked'$$, '42501', NULL, 'anon cannot edit categories');
SELECT throws_ok($$SELECT cms_publish('e0000000-0000-4000-8000-000000000002', NULL, 0, false)$$, '42501', NULL, 'anon cannot publish');

RESET ROLE;

-- Signed-in users get exactly what visitors get ------------------------------
SET LOCAL ROLE authenticated;

SELECT throws_ok('SELECT id FROM cms_content', '42501', NULL, 'authenticated cannot read working copies');
SELECT results_eq('SELECT slug FROM cms_content_published', ARRAY['live-post-renamed'], 'authenticated reads published posts');
SELECT throws_ok($$SELECT cms_trash('e0000000-0000-4000-8000-000000000001', NULL, NULL)$$, '42501', NULL, 'authenticated cannot trash');

RESET ROLE;

-- A redirect disappears with the post it points at --------------------------
SELECT cms_unpublish('e0000000-0000-4000-8000-000000000001', NULL, NULL, 'draft');
SET LOCAL ROLE anon;
SELECT is_empty('SELECT old_slug FROM cms_slug_redirects', 'no redirects to unpublished posts');
SELECT is_empty('SELECT slug FROM cms_content_published', 'unpublished post is gone for visitors');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
