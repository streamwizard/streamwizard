-- Editorial notes on a draft, and where it stands in review.
--
-- Comments hang off a heading anchor or a guide section rather than a
-- position in the text: anchors are stable now, and a character offset in a
-- document that is still being rewritten points somewhere else by morning.
-- A comment whose heading disappears falls back to the post as a whole.

CREATE TABLE public.cms_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.cms_content(id) ON DELETE CASCADE,
  -- The guide section it is about, when it is about one.
  section_id uuid REFERENCES public.cms_guide_sections(id) ON DELETE SET NULL,
  -- The heading it is about. Just text: a heading can be deleted, and the
  -- comment should survive as a note on the post.
  anchor text,
  -- The comment it replies to. A thread is one level deep.
  parent_id uuid REFERENCES public.cms_comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cms_comments_pkey PRIMARY KEY (id),
  CONSTRAINT cms_comments_body_check CHECK (char_length(body) BETWEEN 1 AND 4000),
  CONSTRAINT cms_comments_anchor_check CHECK (anchor IS NULL OR public.cms_is_valid_slug(anchor))
  -- Threads are one level deep. Not expressible here, so the queries hold to
  -- it: a reply is always made against a comment with no parent of its own.
);
CREATE INDEX cms_comments_content_idx ON public.cms_comments (content_id, created_at);
CREATE INDEX cms_comments_parent_idx ON public.cms_comments (parent_id);

-- Where the draft stands. Advisory on purpose: it does not gate publishing,
-- so nothing about the publish path or the readiness checks changes.
ALTER TABLE public.cms_content
  ADD COLUMN review_state text NOT NULL DEFAULT 'none',
  ADD CONSTRAINT cms_content_review_state_check
    CHECK (review_state IN ('none', 'requested', 'changes', 'approved'));

ALTER TABLE public.cms_comments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.cms_comments FROM anon, authenticated;
GRANT ALL ON public.cms_comments TO service_role;

-- Rewritten from its definition in 20261014120200, with review_state added to
-- the workflow columns a snapshot leaves out: a revision restores what was
-- written, not where the draft stood in review.
CREATE OR REPLACE FUNCTION public.cms_content_snapshot(p_content_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT to_jsonb(c)
      - 'status' - 'publish_at' - 'scheduled_by' - 'schedule_error' - 'first_published_at'
      - 'content_updated_at' - 'lock_version' - 'revalidate_tags' - 'created_by' - 'updated_by'
      - 'created_at' - 'updated_at' - 'deleted_at' - 'review_state'
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
