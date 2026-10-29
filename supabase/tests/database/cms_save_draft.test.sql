-- Saving drafts and restoring revisions. Run: supabase test db --local
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(22);

INSERT INTO cms_authors (id, slug, name) VALUES
  ('b3000000-0000-4000-8000-000000000001', 'one', 'One'),
  ('b3000000-0000-4000-8000-000000000002', 'two', 'Two');
INSERT INTO cms_categories (id, slug, name) VALUES ('c3000000-0000-4000-8000-000000000001', 'obs', 'OBS');
INSERT INTO cms_tags (id, slug, name) VALUES ('d3000000-0000-4000-8000-000000000001', 'alerts', 'Alerts');
INSERT INTO cms_content (id, type, title, slug) VALUES
  ('e3000000-0000-4000-8000-000000000001', 'guide', 'Draft', 'draft-guide'),
  ('e3000000-0000-4000-8000-000000000002', 'blog', 'Other', 'other-post');

-- A full save -----------------------------------------------------------------
SELECT is(
  (cms_save_draft(
    'e3000000-0000-4000-8000-000000000001', NULL, 0,
    '{"title": "Set up OBS", "slug": "set-up-obs", "excerpt": "Short", "status": "published", "lock_version": 99, "word_count": 12}',
    '[{"title": "Install", "anchor": "install", "body_text": "download"}, {"title": "Scenes", "anchor": "scenes"}]',
    ARRAY['b3000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000001']::uuid[],
    ARRAY['c3000000-0000-4000-8000-000000000001']::uuid[],
    ARRAY['d3000000-0000-4000-8000-000000000001']::uuid[],
    ARRAY['e3000000-0000-4000-8000-000000000002', 'e3000000-0000-4000-8000-000000000001']::uuid[],
    'autosave'
  )->>'lock_version')::int,
  1, 'returns the new lock version'
);
SELECT is((SELECT title FROM cms_content WHERE id = 'e3000000-0000-4000-8000-000000000001'), 'Set up OBS', 'fields saved');
SELECT is((SELECT status FROM cms_content WHERE id = 'e3000000-0000-4000-8000-000000000001'), 'draft', 'status is not editable here');
SELECT is((SELECT lock_version FROM cms_content WHERE id = 'e3000000-0000-4000-8000-000000000001'), 1, 'lock_version from the payload is ignored');
SELECT is((SELECT array_agg(anchor ORDER BY position) FROM cms_guide_sections WHERE content_id = 'e3000000-0000-4000-8000-000000000001'), ARRAY['install', 'scenes'], 'sections in order');
SELECT is((SELECT array_agg(author_id ORDER BY position) FROM cms_content_authors WHERE content_id = 'e3000000-0000-4000-8000-000000000001'),
  ARRAY['b3000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000001']::uuid[], 'authors keep their order');
SELECT is((SELECT count(*)::int FROM cms_related_content WHERE content_id = 'e3000000-0000-4000-8000-000000000001'), 1, 'a post is never related to itself');
SELECT is((SELECT count(*)::int FROM cms_revisions WHERE content_id = 'e3000000-0000-4000-8000-000000000001' AND kind = 'autosave'), 1, 'first autosave writes a revision');

-- Partial saves, reorders, coalesced autosaves -------------------------------
CREATE TEMP TABLE first_section AS
  SELECT id FROM cms_guide_sections WHERE content_id = 'e3000000-0000-4000-8000-000000000001' AND anchor = 'install';
SELECT cms_save_draft(
  'e3000000-0000-4000-8000-000000000001', NULL, 1, '{"excerpt": "Longer"}',
  jsonb_build_array(jsonb_build_object('title', 'Scenes v2', 'anchor', 'scenes'), jsonb_build_object('id', (SELECT id FROM first_section), 'title', 'Install', 'anchor', 'install')),
  NULL, NULL, NULL, NULL, 'autosave'
);
SELECT is((SELECT title FROM cms_content WHERE id = 'e3000000-0000-4000-8000-000000000001'), 'Set up OBS', 'keys left out keep their value');
SELECT is((SELECT position FROM cms_guide_sections WHERE id = (SELECT id FROM first_section)), 1::smallint, 'a kept section moves');
SELECT is((SELECT count(*)::int FROM cms_guide_sections WHERE content_id = 'e3000000-0000-4000-8000-000000000001'), 2, 'the dropped section is gone, the new one added');
SELECT is((SELECT count(*)::int FROM cms_content_authors WHERE content_id = 'e3000000-0000-4000-8000-000000000001'), 2, 'null credits are left alone');
SELECT is((SELECT count(*)::int FROM cms_revisions WHERE content_id = 'e3000000-0000-4000-8000-000000000001' AND kind = 'autosave'), 1, 'autosaves within 10 minutes share a revision');

SELECT cms_save_draft('e3000000-0000-4000-8000-000000000001', NULL, 2, '{"title": "Manual"}', NULL, NULL, NULL, NULL, NULL, 'manual');
SELECT is((SELECT count(*)::int FROM cms_revisions WHERE content_id = 'e3000000-0000-4000-8000-000000000001' AND kind = 'manual'), 1, 'a manual save always writes one');

-- Refusals ------------------------------------------------------------------
SELECT throws_ok($$SELECT cms_save_draft('e3000000-0000-4000-8000-000000000001', NULL, 0, '{}')$$, 'P0001', 'cms_conflict', 'stale lock version');
SELECT throws_like($$SELECT cms_save_draft('e3000000-0000-4000-8000-000000000002', NULL, 0, '{}', '[{"title": "x", "anchor": "x"}]')$$, 'cms_invalid: only guides%', 'blog posts have no sections');
SELECT throws_ok($$SELECT cms_save_draft('e3000000-0000-4000-8000-000000000002', NULL, 0, '{"slug": "Bad Slug"}')$$, '23514', NULL, 'slug rules still apply');
INSERT INTO cms_content (id, type, title, slug) VALUES ('e3000000-0000-4000-8000-000000000003', 'guide', 'Third', 'third');
INSERT INTO cms_guide_sections (id, content_id, position, title, anchor) VALUES
  ('f3000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000003', 0, 'Theirs', 'theirs');
SELECT throws_like(
  $$SELECT cms_save_draft('e3000000-0000-4000-8000-000000000001', NULL, 3, '{}', '[{"id": "f3000000-0000-4000-8000-000000000001", "title": "x", "anchor": "stolen"}]')$$,
  'cms_invalid: section % belongs to another post', 'cannot take over another post''s section'
);

-- Restore -------------------------------------------------------------------
CREATE TEMP TABLE first_revision AS
  SELECT id FROM cms_revisions WHERE content_id = 'e3000000-0000-4000-8000-000000000001' AND kind = 'autosave';
DELETE FROM cms_content_tags;
DELETE FROM cms_tags WHERE id = 'd3000000-0000-4000-8000-000000000001';
SELECT cms_restore_revision('e3000000-0000-4000-8000-000000000001', NULL,
  (SELECT lock_version FROM cms_content WHERE id = 'e3000000-0000-4000-8000-000000000001'), (SELECT id FROM first_revision));
SELECT is((SELECT title FROM cms_content WHERE id = 'e3000000-0000-4000-8000-000000000001'), 'Set up OBS', 'restore brings the old title back');
SELECT is((SELECT array_agg(title ORDER BY position) FROM cms_guide_sections WHERE content_id = 'e3000000-0000-4000-8000-000000000001'), ARRAY['Install', 'Scenes'], 'and the old sections');
SELECT is((SELECT count(*)::int FROM cms_revisions WHERE content_id = 'e3000000-0000-4000-8000-000000000001' AND kind = 'restore'), 1, 'the replaced state is kept');
SELECT is((SELECT status FROM cms_content WHERE id = 'e3000000-0000-4000-8000-000000000001'), 'draft', 'restore never publishes');

SELECT * FROM finish();
ROLLBACK;
