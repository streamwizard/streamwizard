-- CMS, part 4: saving the working copy, and restoring a revision.
--
-- The editor autosaves a whole draft at once: the post's fields, a guide's
-- sections and the credits (authors, categories, tags, related posts). One
-- function does all of it in one transaction behind the lock_version check,
-- so two tabs can't interleave half-saves and a conflict leaves nothing
-- written. Same error prefixes as the publish functions (cms_not_found,
-- cms_conflict, cms_invalid: …). The live site is never touched here: only
-- cms_publish writes the public copy.

-- p_fields: the editable columns of cms_content, keyed by column name. Keys
-- that are left out keep their current value; workflow columns (status,
-- dates, lock_version, …) are ignored even when present.
-- p_sections: [{ id?, title, anchor, body, body_text }] in order, or null to
-- leave sections alone. Sections not in the list are deleted.
-- The four id arrays replace the credits; null leaves them alone.
-- p_revision: 'autosave' writes a revision at most every 10 minutes,
-- 'manual' always writes one, 'none' never does.
CREATE OR REPLACE FUNCTION public.cms_save_draft(
  p_content_id uuid,
  p_actor uuid,
  p_expected_lock_version integer,
  p_fields jsonb,
  p_sections jsonb DEFAULT NULL,
  p_author_ids uuid[] DEFAULT NULL,
  p_category_ids uuid[] DEFAULT NULL,
  p_tag_ids uuid[] DEFAULT NULL,
  p_related_ids uuid[] DEFAULT NULL,
  p_revision text DEFAULT 'autosave'
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c cms_content;
  r cms_content;
  v_lock integer;
  v_updated_at timestamptz;
  v_section jsonb;
  v_keep uuid[] := '{}';
  v_id uuid;
BEGIN
  IF p_revision NOT IN ('autosave', 'manual', 'none') THEN
    RAISE EXCEPTION 'cms_invalid: unknown revision kind %', p_revision;
  END IF;
  c := cms_lock_content(p_content_id, p_expected_lock_version);
  r := jsonb_populate_record(c, coalesce(p_fields, '{}'::jsonb));

  IF c.type <> 'guide' AND p_sections IS NOT NULL AND jsonb_array_length(p_sections) > 0 THEN
    RAISE EXCEPTION 'cms_invalid: only guides have sections';
  END IF;

  UPDATE cms_content SET
    title = r.title,
    slug = r.slug,
    excerpt = r.excerpt,
    summary = r.summary,
    cover_asset_id = r.cover_asset_id,
    body = r.body,
    body_text = r.body_text,
    toc = r.toc,
    word_count = r.word_count,
    reading_time_minutes = r.reading_time_minutes,
    seo_title = r.seo_title,
    seo_description = r.seo_description,
    og_asset_id = r.og_asset_id,
    canonical_url = r.canonical_url,
    noindex = r.noindex,
    primary_category_id = r.primary_category_id,
    is_featured = r.is_featured,
    pinned_rank = r.pinned_rank,
    comments_enabled = r.comments_enabled,
    difficulty = r.difficulty,
    estimated_minutes = r.estimated_minutes,
    prerequisites = r.prerequisites,
    lock_version = lock_version + 1,
    updated_by = coalesce(p_actor, updated_by)
  WHERE id = c.id
  RETURNING lock_version, updated_at INTO v_lock, v_updated_at;

  IF p_sections IS NOT NULL THEN
    -- Positions and anchors are deferred-unique, so a reorder can swap them.
    FOR v_section IN SELECT value FROM jsonb_array_elements(p_sections) WITH ORDINALITY AS s(value, n) ORDER BY n LOOP
      v_id := coalesce(nullif(v_section->>'id', '')::uuid, gen_random_uuid());
      INSERT INTO cms_guide_sections AS gs (id, content_id, position, title, anchor, body, body_text)
      VALUES (
        v_id, c.id, cardinality(v_keep),
        coalesce(v_section->>'title', ''), v_section->>'anchor',
        coalesce(v_section->'body', '{"type": "doc", "content": []}'::jsonb), coalesce(v_section->>'body_text', '')
      )
      ON CONFLICT (id) DO UPDATE SET
        position = EXCLUDED.position, title = EXCLUDED.title, anchor = EXCLUDED.anchor,
        body = EXCLUDED.body, body_text = EXCLUDED.body_text
      WHERE gs.content_id = c.id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'cms_invalid: section % belongs to another post', v_id;
      END IF;
      v_keep := v_keep || v_id;
    END LOOP;
    DELETE FROM cms_guide_sections WHERE content_id = c.id AND NOT (id = ANY (v_keep));
  END IF;

  IF p_author_ids IS NOT NULL THEN
    DELETE FROM cms_content_authors WHERE content_id = c.id;
    INSERT INTO cms_content_authors (content_id, author_id, position)
    SELECT c.id, a.id, (a.n - 1)::smallint FROM unnest(p_author_ids) WITH ORDINALITY AS a(id, n)
    ON CONFLICT DO NOTHING;
  END IF;
  IF p_category_ids IS NOT NULL THEN
    DELETE FROM cms_content_categories WHERE content_id = c.id;
    INSERT INTO cms_content_categories (content_id, category_id)
    SELECT DISTINCT c.id, x FROM unnest(p_category_ids) x;
  END IF;
  IF p_tag_ids IS NOT NULL THEN
    DELETE FROM cms_content_tags WHERE content_id = c.id;
    INSERT INTO cms_content_tags (content_id, tag_id)
    SELECT DISTINCT c.id, x FROM unnest(p_tag_ids) x;
  END IF;
  IF p_related_ids IS NOT NULL THEN
    DELETE FROM cms_related_content WHERE content_id = c.id;
    INSERT INTO cms_related_content (content_id, related_id, position)
    SELECT c.id, x.id, (x.n - 1)::smallint FROM unnest(p_related_ids) WITH ORDINALITY AS x(id, n)
    WHERE x.id <> c.id
    ON CONFLICT DO NOTHING;
  END IF;

  IF p_revision = 'manual' OR (
    p_revision = 'autosave' AND NOT EXISTS (
      SELECT 1 FROM cms_revisions
      WHERE content_id = c.id AND kind IN ('autosave', 'manual') AND created_at > now() - interval '10 minutes'
    )
  ) THEN
    INSERT INTO cms_revisions (content_id, kind, snapshot, created_by)
    VALUES (c.id, p_revision, cms_content_snapshot(c.id), p_actor);
  END IF;

  RETURN jsonb_build_object('lock_version', v_lock, 'updated_at', v_updated_at);
END;
$$;

-- Puts a revision back into the working copy. The state it replaces is kept
-- as a 'restore' revision first, so a restore can itself be undone. Credits
-- that point at something deleted since are dropped. Never publishes.
CREATE OR REPLACE FUNCTION public.cms_restore_revision(
  p_content_id uuid,
  p_actor uuid,
  p_expected_lock_version integer,
  p_revision_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  s jsonb;
BEGIN
  SELECT snapshot INTO s FROM cms_revisions WHERE id = p_revision_id AND content_id = p_content_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cms_not_found';
  END IF;
  PERFORM cms_lock_content(p_content_id, p_expected_lock_version);

  INSERT INTO cms_revisions (content_id, kind, snapshot, created_by)
  VALUES (p_content_id, 'restore', cms_content_snapshot(p_content_id), p_actor);

  -- Assets a revision points at are never cleaned up while it exists, but a
  -- cover could still have been deleted by hand.
  IF s->>'cover_asset_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cms_assets WHERE id = (s->>'cover_asset_id')::uuid) THEN
    s := s || '{"cover_asset_id": null}'::jsonb;
  END IF;
  IF s->>'og_asset_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cms_assets WHERE id = (s->>'og_asset_id')::uuid) THEN
    s := s || '{"og_asset_id": null}'::jsonb;
  END IF;
  IF s->>'primary_category_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cms_categories WHERE id = (s->>'primary_category_id')::uuid) THEN
    s := s || '{"primary_category_id": null}'::jsonb;
  END IF;

  RETURN cms_save_draft(
    p_content_id,
    p_actor,
    NULL,
    s - 'id' - 'type' - 'sections' - 'author_ids' - 'category_ids' - 'tag_ids' - 'related_ids',
    coalesce(s->'sections', '[]'::jsonb),
    ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(coalesce(s->'author_ids', '[]')) x WHERE x::uuid IN (SELECT id FROM cms_authors)),
    ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(coalesce(s->'category_ids', '[]')) x WHERE x::uuid IN (SELECT id FROM cms_categories)),
    ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(coalesce(s->'tag_ids', '[]')) x WHERE x::uuid IN (SELECT id FROM cms_tags)),
    ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(coalesce(s->'related_ids', '[]')) x WHERE x::uuid IN (SELECT id FROM cms_content WHERE deleted_at IS NULL)),
    'none'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cms_save_draft(uuid, uuid, integer, jsonb, jsonb, uuid[], uuid[], uuid[], uuid[], text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cms_restore_revision(uuid, uuid, integer, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cms_save_draft(uuid, uuid, integer, jsonb, jsonb, uuid[], uuid[], uuid[], uuid[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cms_restore_revision(uuid, uuid, integer, uuid) TO service_role;
