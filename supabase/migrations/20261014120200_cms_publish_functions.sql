-- CMS, part 3: the functions that move a post on and off the public site.
--
-- Each runs as one transaction, so the working copy, the public copy, the
-- redirects and the revision history can't disagree. They return the post's
-- public "footprint" before and after ({ id, type, category_ids, tag_ids,
-- author_ids } or null), which the caller feeds to @repo/cms tagsForChange to
-- know which cached pages to refresh.
--
-- Errors are raised with a stable message prefix the TypeScript side matches:
--   cms_not_found   no such post, or it is in the trash
--   cms_conflict    lock_version moved: someone else saved in between
--   cms_invalid: …  the post can't make this move (reason follows)
--
-- SECURITY INVOKER and service_role only: web-admin and the rest-api scheduler
-- call them with the service-role client. Nothing here is reachable by anon or
-- authenticated.

-- Every asset id a JSON value mentions: Tiptap image nodes (attrs.assetId),
-- snapshot columns (cover_asset_id, og_asset_id) and published covers
-- (asset_id), at any depth.
CREATE OR REPLACE FUNCTION public.cms_jsonb_asset_ids(p_value jsonb)
RETURNS SETOF uuid
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT DISTINCT (v #>> '{}')::uuid
  FROM (
    SELECT jsonb_path_query(p_value, 'lax $.**.assetId') AS v
    UNION ALL SELECT jsonb_path_query(p_value, 'lax $.**.asset_id')
    UNION ALL SELECT jsonb_path_query(p_value, 'lax $.**.cover_asset_id')
    UNION ALL SELECT jsonb_path_query(p_value, 'lax $.**.og_asset_id')
  ) found
  WHERE jsonb_typeof(v) = 'string'
    AND (v #>> '{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

-- The editable state of a post, for cms_revisions: the working copy without
-- its workflow columns, plus sections and credits. Restoring a revision
-- writes these fields back; it never changes status or dates.
CREATE OR REPLACE FUNCTION public.cms_content_snapshot(p_content_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT to_jsonb(c)
      - 'status' - 'publish_at' - 'scheduled_by' - 'schedule_error' - 'first_published_at'
      - 'content_updated_at' - 'lock_version' - 'revalidate_tags' - 'created_by' - 'updated_by'
      - 'created_at' - 'updated_at' - 'deleted_at'
    || jsonb_build_object(
      'sections', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'anchor', s.anchor, 'body', s.body, 'body_text', s.body_text) ORDER BY s.position)
        FROM cms_guide_sections s WHERE s.content_id = c.id
      ), '[]'::jsonb),
      'author_ids', coalesce((SELECT jsonb_agg(a.author_id ORDER BY a.position, a.author_id) FROM cms_content_authors a WHERE a.content_id = c.id), '[]'::jsonb),
      'category_ids', coalesce((SELECT jsonb_agg(x.category_id ORDER BY x.category_id) FROM cms_content_categories x WHERE x.content_id = c.id), '[]'::jsonb),
      'tag_ids', coalesce((SELECT jsonb_agg(x.tag_id ORDER BY x.tag_id) FROM cms_content_tags x WHERE x.content_id = c.id), '[]'::jsonb),
      'related_ids', coalesce((SELECT jsonb_agg(x.related_id ORDER BY x.position, x.related_id) FROM cms_related_content x WHERE x.content_id = c.id), '[]'::jsonb)
    )
  FROM cms_content c
  WHERE c.id = p_content_id;
$$;

CREATE OR REPLACE FUNCTION public.cms_published_footprint(p cms_content_published)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', p.content_id,
    'type', p.type,
    'category_ids', to_jsonb(p.category_ids),
    'tag_ids', to_jsonb(p.tag_ids),
    'author_ids', to_jsonb(p.author_ids)
  );
$$;

-- Locks the working copy and checks it can be acted on.
CREATE OR REPLACE FUNCTION public.cms_lock_content(p_content_id uuid, p_expected_lock_version integer)
RETURNS cms_content
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c cms_content;
BEGIN
  SELECT * INTO c FROM cms_content WHERE id = p_content_id FOR UPDATE;
  IF NOT FOUND OR c.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'cms_not_found';
  END IF;
  IF p_expected_lock_version IS NOT NULL AND c.lock_version <> p_expected_lock_version THEN
    RAISE EXCEPTION 'cms_conflict';
  END IF;
  RETURN c;
END;
$$;

-- Publish now, or push the working copy of a live post to the site
-- ("Update"). From any status. A minor edit keeps the public "Updated" date.
--
-- Returns { before, after, lock_version, first_publish }.
CREATE OR REPLACE FUNCTION public.cms_publish(
  p_content_id uuid,
  p_actor uuid,
  p_expected_lock_version integer,
  p_minor_edit boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c cms_content;
  prev cms_content_published;
  had_prev boolean;
  v_now timestamptz := now();
  v_author_ids uuid[];
  v_category_ids uuid[];
  v_tag_ids uuid[];
  v_related_ids uuid[];
  v_sections jsonb;
  v_body_text text;
  v_assets jsonb;
  v_updated_at timestamptz;
  v_lock integer;
BEGIN
  c := cms_lock_content(p_content_id, p_expected_lock_version);

  IF btrim(c.title) = '' THEN
    RAISE EXCEPTION 'cms_invalid: a title is required';
  END IF;

  SELECT coalesce(array_agg(author_id ORDER BY position, author_id), '{}') INTO v_author_ids
    FROM cms_content_authors WHERE content_id = c.id;
  IF cardinality(v_author_ids) = 0 THEN
    RAISE EXCEPTION 'cms_invalid: at least one author is required';
  END IF;
  SELECT coalesce(array_agg(category_id ORDER BY category_id), '{}') INTO v_category_ids
    FROM cms_content_categories WHERE content_id = c.id;
  SELECT coalesce(array_agg(tag_id ORDER BY tag_id), '{}') INTO v_tag_ids
    FROM cms_content_tags WHERE content_id = c.id;
  SELECT coalesce(array_agg(related_id ORDER BY position, related_id), '{}') INTO v_related_ids
    FROM cms_related_content WHERE content_id = c.id;

  -- Sections and their text (search covers the whole guide).
  IF c.type = 'guide' THEN
    SELECT
      coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'anchor', s.anchor, 'body', s.body) ORDER BY s.position), '[]'::jsonb),
      concat_ws(E'\n', c.body_text, string_agg(concat_ws(E'\n', s.title, s.body_text), E'\n' ORDER BY s.position))
    INTO v_sections, v_body_text
    FROM cms_guide_sections s WHERE s.content_id = c.id;
  ELSE
    v_sections := '[]'::jsonb;
    v_body_text := c.body_text;
  END IF;

  -- Every image on the page, resolved now so the public render is one read.
  SELECT coalesce(jsonb_object_agg(
      a.id::text,
      jsonb_build_object('key', a.key, 'width', a.width, 'height', a.height, 'mime_type', a.mime_type, 'alt', a.alt, 'decorative', a.is_decorative)
    ), '{}'::jsonb)
  INTO v_assets
  FROM cms_assets a
  WHERE a.status = 'ready'
    AND a.id IN (
      SELECT cms_jsonb_asset_ids(c.body)
      UNION SELECT x FROM cms_guide_sections s, LATERAL cms_jsonb_asset_ids(s.body) x WHERE s.content_id = c.id AND c.type = 'guide'
      UNION SELECT c.cover_asset_id
      UNION SELECT c.og_asset_id
    );

  SELECT * INTO prev FROM cms_content_published WHERE content_id = c.id FOR UPDATE;
  had_prev := FOUND;

  -- The old URL keeps working after a slug change.
  IF had_prev AND (prev.slug <> c.slug OR prev.type <> c.type) THEN
    INSERT INTO cms_slug_redirects (type, old_slug, content_id) VALUES (prev.type, prev.slug, c.id)
    ON CONFLICT (type, old_slug) DO UPDATE SET content_id = EXCLUDED.content_id, created_at = now();
  END IF;
  -- A live slug never redirects: if another post used to live here, its old
  -- URL now belongs to this one.
  DELETE FROM cms_slug_redirects WHERE type = c.type AND old_slug = c.slug;

  v_updated_at := CASE WHEN p_minor_edit AND had_prev THEN prev.content_updated_at ELSE v_now END;

  INSERT INTO cms_content_published (
    content_id, type, slug, title, excerpt, summary, cover, og_image, body, sections, toc, assets, body_text,
    word_count, reading_time_minutes, seo_title, seo_description, canonical_url, noindex,
    difficulty, estimated_minutes, prerequisites,
    author_ids, category_ids, tag_ids, related_ids, primary_category_id, is_featured, pinned_rank, comments_enabled,
    first_published_at, content_updated_at, snapshot_at
  ) VALUES (
    c.id, c.type, c.slug, c.title, c.excerpt, c.summary,
    CASE WHEN c.cover_asset_id IS NULL THEN NULL ELSE jsonb_build_object('asset_id', c.cover_asset_id) END,
    CASE WHEN c.og_asset_id IS NULL THEN NULL ELSE jsonb_build_object('asset_id', c.og_asset_id) END,
    c.body, v_sections, c.toc, v_assets, coalesce(v_body_text, ''),
    c.word_count, c.reading_time_minutes, c.seo_title, c.seo_description, c.canonical_url, c.noindex,
    c.difficulty, c.estimated_minutes, c.prerequisites,
    v_author_ids, v_category_ids, v_tag_ids, v_related_ids, c.primary_category_id, c.is_featured, c.pinned_rank, c.comments_enabled,
    coalesce(c.first_published_at, v_now), v_updated_at, v_now
  )
  ON CONFLICT (content_id) DO UPDATE SET
    type = EXCLUDED.type, slug = EXCLUDED.slug, title = EXCLUDED.title, excerpt = EXCLUDED.excerpt,
    summary = EXCLUDED.summary, cover = EXCLUDED.cover, og_image = EXCLUDED.og_image, body = EXCLUDED.body,
    sections = EXCLUDED.sections, toc = EXCLUDED.toc, assets = EXCLUDED.assets, body_text = EXCLUDED.body_text,
    word_count = EXCLUDED.word_count, reading_time_minutes = EXCLUDED.reading_time_minutes,
    seo_title = EXCLUDED.seo_title, seo_description = EXCLUDED.seo_description,
    canonical_url = EXCLUDED.canonical_url, noindex = EXCLUDED.noindex, difficulty = EXCLUDED.difficulty,
    estimated_minutes = EXCLUDED.estimated_minutes, prerequisites = EXCLUDED.prerequisites,
    author_ids = EXCLUDED.author_ids, category_ids = EXCLUDED.category_ids, tag_ids = EXCLUDED.tag_ids,
    related_ids = EXCLUDED.related_ids, primary_category_id = EXCLUDED.primary_category_id,
    is_featured = EXCLUDED.is_featured, pinned_rank = EXCLUDED.pinned_rank,
    comments_enabled = EXCLUDED.comments_enabled, first_published_at = EXCLUDED.first_published_at,
    content_updated_at = EXCLUDED.content_updated_at, snapshot_at = EXCLUDED.snapshot_at;

  UPDATE cms_content SET
    status = 'published',
    publish_at = NULL,
    scheduled_by = NULL,
    schedule_error = NULL,
    first_published_at = coalesce(first_published_at, v_now),
    content_updated_at = v_updated_at,
    lock_version = lock_version + 1,
    updated_by = coalesce(p_actor, updated_by)
  WHERE id = c.id
  RETURNING lock_version INTO v_lock;

  INSERT INTO cms_revisions (content_id, kind, snapshot, created_by)
  VALUES (c.id, 'publish', cms_content_snapshot(c.id), p_actor);

  RETURN jsonb_build_object(
    'before', CASE WHEN had_prev THEN cms_published_footprint(prev) ELSE NULL END,
    'after', jsonb_build_object(
      'id', c.id, 'type', c.type,
      'category_ids', to_jsonb(v_category_ids), 'tag_ids', to_jsonb(v_tag_ids), 'author_ids', to_jsonb(v_author_ids)
    ),
    'lock_version', v_lock,
    'first_publish', c.first_published_at IS NULL
  );
END;
$$;

-- Take a live post off the site: back to draft (unpublish) or archived.
-- Returns { before, lock_version }.
CREATE OR REPLACE FUNCTION public.cms_unpublish(
  p_content_id uuid,
  p_actor uuid,
  p_expected_lock_version integer,
  p_to_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c cms_content;
  prev cms_content_published;
  v_lock integer;
BEGIN
  IF p_to_status NOT IN ('draft', 'archived') THEN
    RAISE EXCEPTION 'cms_invalid: unpublish goes to draft or archived, not %', p_to_status;
  END IF;
  c := cms_lock_content(p_content_id, p_expected_lock_version);
  IF c.status <> 'published' THEN
    RAISE EXCEPTION 'cms_invalid: a % post is not on the site', c.status;
  END IF;

  DELETE FROM cms_content_published WHERE content_id = c.id RETURNING * INTO prev;

  UPDATE cms_content SET
    status = p_to_status,
    lock_version = lock_version + 1,
    updated_by = coalesce(p_actor, updated_by)
  WHERE id = c.id
  RETURNING lock_version INTO v_lock;

  RETURN jsonb_build_object(
    'before', CASE WHEN prev.content_id IS NULL THEN NULL ELSE cms_published_footprint(prev) END,
    'lock_version', v_lock
  );
END;
$$;

-- Move a post to the trash, from any status. Takes it off the site and
-- revokes its preview links. Restoring (deleted_at = null) is a plain update
-- and lands as a draft. Returns { before }.
CREATE OR REPLACE FUNCTION public.cms_trash(p_content_id uuid, p_actor uuid, p_expected_lock_version integer)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c cms_content;
  prev cms_content_published;
BEGIN
  c := cms_lock_content(p_content_id, p_expected_lock_version);

  DELETE FROM cms_content_published WHERE content_id = c.id RETURNING * INTO prev;

  UPDATE cms_content SET
    status = 'draft',
    publish_at = NULL,
    scheduled_by = NULL,
    deleted_at = now(),
    lock_version = lock_version + 1,
    updated_by = coalesce(p_actor, updated_by)
  WHERE id = c.id;

  UPDATE cms_preview_tokens SET revoked_at = now() WHERE content_id = c.id AND revoked_at IS NULL;

  RETURN jsonb_build_object('before', CASE WHEN prev.content_id IS NULL THEN NULL ELSE cms_published_footprint(prev) END);
END;
$$;

-- The rest-api scheduler's tick: publish every scheduled post whose time has
-- come, on behalf of whoever scheduled it. SKIP LOCKED makes two schedulers
-- (or a scheduler and an admin pressing Publish) safe: each post is taken by
-- exactly one transaction.
--
-- A post that can't be published (say its only author was removed) goes back
-- to draft with schedule_error set, instead of failing the whole tick on
-- every run. One row per post handled.
CREATE OR REPLACE FUNCTION public.cms_claim_due_scheduled(p_limit integer DEFAULT 20)
RETURNS TABLE (content_id uuid, scheduled_by uuid, ok boolean, result jsonb, error text)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.id, c.lock_version, c.scheduled_by
    FROM cms_content c
    WHERE c.status = 'scheduled' AND c.deleted_at IS NULL AND c.publish_at <= now()
    ORDER BY c.publish_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    content_id := r.id;
    scheduled_by := r.scheduled_by;
    BEGIN
      result := cms_publish(r.id, r.scheduled_by, r.lock_version, false);
      ok := true;
      error := NULL;
    EXCEPTION WHEN OTHERS THEN
      ok := false;
      result := NULL;
      error := SQLERRM;
      UPDATE cms_content SET status = 'draft', schedule_error = SQLERRM, lock_version = lock_version + 1
        WHERE id = r.id;
    END;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Ready images nothing uses any more, older than p_older_than: not a cover,
-- OG image, avatar or inline image of any working copy, guide section,
-- published post or kept revision. Uploads that never got confirmed
-- (pending) are swept separately. The reconciler deletes the row first, then
-- the R2 object.
CREATE OR REPLACE FUNCTION public.cms_unreferenced_assets(p_older_than interval)
RETURNS TABLE (id uuid, key text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH refs AS (
    SELECT cover_asset_id AS id FROM cms_content WHERE cover_asset_id IS NOT NULL
    UNION SELECT og_asset_id FROM cms_content WHERE og_asset_id IS NOT NULL
    UNION SELECT avatar_asset_id FROM cms_authors WHERE avatar_asset_id IS NOT NULL
    UNION SELECT x FROM cms_content, LATERAL cms_jsonb_asset_ids(body) x
    UNION SELECT x FROM cms_guide_sections, LATERAL cms_jsonb_asset_ids(body) x
    UNION SELECT k::uuid FROM cms_content_published, LATERAL jsonb_object_keys(assets) k
    UNION SELECT x FROM cms_revisions, LATERAL cms_jsonb_asset_ids(snapshot) x
  )
  SELECT a.id, a.key
  FROM cms_assets a
  WHERE a.status = 'ready'
    AND a.created_at < now() - p_older_than
    AND NOT EXISTS (SELECT 1 FROM refs WHERE refs.id = a.id);
$$;

REVOKE EXECUTE ON FUNCTION public.cms_jsonb_asset_ids(jsonb) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cms_content_snapshot(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cms_published_footprint(cms_content_published) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cms_lock_content(uuid, integer) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cms_publish(uuid, uuid, integer, boolean) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cms_unpublish(uuid, uuid, integer, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cms_trash(uuid, uuid, integer) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cms_claim_due_scheduled(integer) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cms_unreferenced_assets(interval) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.cms_jsonb_asset_ids(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.cms_content_snapshot(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cms_published_footprint(cms_content_published) TO service_role;
GRANT EXECUTE ON FUNCTION public.cms_lock_content(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cms_publish(uuid, uuid, integer, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.cms_unpublish(uuid, uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cms_trash(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cms_claim_due_scheduled(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cms_unreferenced_assets(interval) TO service_role;
