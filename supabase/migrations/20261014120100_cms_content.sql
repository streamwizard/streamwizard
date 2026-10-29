-- CMS, part 2: posts and guides.
--
-- Two copies of every post:
--
--   cms_content            the working copy. web-admin autosaves into it, so it
--                          is admin-only (service role). Drafts live here.
--   cms_content_published  what the public site shows. Written only by
--                          cms_publish (next migration), removed by
--                          cms_unpublish / cms_trash. The one table anon reads.
--
-- Editing a live post therefore changes nothing on the site until "Update".
-- A bug in a draft query can't leak a draft: anon has no access to the
-- working copy at all.
--
-- Bodies are Tiptap JSON, cleaned by @repo/cms sanitizeDoc before they get
-- here. body_text, toc, word_count and reading_time_minutes are derived from
-- the body (and a guide's sections) in TypeScript on every save.

CREATE TABLE public.cms_content (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  title text NOT NULL DEFAULT '',
  slug text NOT NULL,
  excerpt text,
  -- Answer-first TL;DR at the top of the page: the passage AI assistants quote.
  summary text,
  cover_asset_id uuid REFERENCES public.cms_assets(id) ON DELETE SET NULL,
  body jsonb NOT NULL DEFAULT '{"type": "doc", "content": []}'::jsonb,
  body_text text NOT NULL DEFAULT '',
  toc jsonb NOT NULL DEFAULT '[]'::jsonb,
  word_count integer NOT NULL DEFAULT 0,
  reading_time_minutes integer NOT NULL DEFAULT 1,
  seo_title text,
  seo_description text,
  og_asset_id uuid REFERENCES public.cms_assets(id) ON DELETE SET NULL,
  -- null = the page's own URL.
  canonical_url text,
  noindex boolean NOT NULL DEFAULT false,
  primary_category_id uuid REFERENCES public.cms_categories(id) ON DELETE SET NULL,
  is_featured boolean NOT NULL DEFAULT false,
  -- null = not pinned; lower numbers sort first.
  pinned_rank smallint,
  comments_enabled boolean NOT NULL DEFAULT true,
  -- Guides only.
  difficulty text,
  estimated_minutes integer,
  prerequisites jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- When a scheduled post goes live, and who scheduled it (the scheduler
  -- publishes on their behalf).
  publish_at timestamptz,
  scheduled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Why the scheduler couldn't publish it; the post is back to draft then.
  schedule_error text,
  -- The public "Published" date: set once, on first publish.
  first_published_at timestamptz,
  -- The public "Updated" date: bumped on every publish except minor edits.
  content_updated_at timestamptz,
  -- Optimistic locking: every write sends the version it read and bumps it.
  -- A mismatch means another tab or admin saved in between.
  lock_version integer NOT NULL DEFAULT 0,
  -- Cache tags whose refresh failed after a change; the rest-api scheduler
  -- retries them.
  revalidate_tags text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Soft delete (trash). Trashing unpublishes first.
  deleted_at timestamptz,
  CONSTRAINT cms_content_pkey PRIMARY KEY (id),
  CONSTRAINT cms_content_type_check CHECK (type IN ('blog', 'guide')),
  CONSTRAINT cms_content_status_check CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  CONSTRAINT cms_content_slug_check CHECK (public.cms_is_valid_slug(slug)),
  CONSTRAINT cms_content_title_check CHECK (char_length(title) <= 200),
  CONSTRAINT cms_content_excerpt_check CHECK (char_length(excerpt) <= 300),
  CONSTRAINT cms_content_summary_check CHECK (char_length(summary) <= 400),
  CONSTRAINT cms_content_seo_title_check CHECK (char_length(seo_title) <= 120),
  CONSTRAINT cms_content_seo_description_check CHECK (char_length(seo_description) <= 300),
  CONSTRAINT cms_content_canonical_check CHECK (canonical_url ~ '^https://[^\s]+$'),
  CONSTRAINT cms_content_body_check CHECK (jsonb_typeof(body) = 'object' AND body->>'type' = 'doc'),
  CONSTRAINT cms_content_toc_check CHECK (jsonb_typeof(toc) = 'array'),
  CONSTRAINT cms_content_counts_check CHECK (word_count >= 0 AND reading_time_minutes >= 1),
  CONSTRAINT cms_content_difficulty_check CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  CONSTRAINT cms_content_estimated_minutes_check CHECK (estimated_minutes > 0),
  CONSTRAINT cms_content_prerequisites_check CHECK (jsonb_typeof(prerequisites) = 'array'),
  CONSTRAINT cms_content_guide_fields_check CHECK (
    type = 'guide' OR (difficulty IS NULL AND estimated_minutes IS NULL AND prerequisites = '[]'::jsonb)
  ),
  CONSTRAINT cms_content_scheduled_check CHECK (status <> 'scheduled' OR publish_at IS NOT NULL)
);

-- A slug is unique per type among posts not in the trash.
CREATE UNIQUE INDEX cms_content_slug_key ON public.cms_content (type, slug) WHERE deleted_at IS NULL;
-- The scheduler's tick.
CREATE INDEX cms_content_due_idx ON public.cms_content (publish_at) WHERE status = 'scheduled' AND deleted_at IS NULL;
-- The admin list (newest edits first) and the trash.
CREATE INDEX cms_content_list_idx ON public.cms_content (type, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX cms_content_trash_idx ON public.cms_content (deleted_at) WHERE deleted_at IS NOT NULL;
-- Failed cache refreshes waiting for a retry.
CREATE INDEX cms_content_revalidate_idx ON public.cms_content (updated_at) WHERE revalidate_tags <> '{}';

-- Credits, in order: position 0 is the primary author (JSON-LD, bylines).
CREATE TABLE public.cms_content_authors (
  content_id uuid NOT NULL REFERENCES public.cms_content(id) ON DELETE CASCADE,
  -- Authors are soft-deleted; a hard delete must not silently uncredit posts.
  author_id uuid NOT NULL REFERENCES public.cms_authors(id) ON DELETE RESTRICT,
  position smallint NOT NULL DEFAULT 0,
  CONSTRAINT cms_content_authors_pkey PRIMARY KEY (content_id, author_id)
);
CREATE INDEX cms_content_authors_author_idx ON public.cms_content_authors (author_id);

CREATE TABLE public.cms_content_categories (
  content_id uuid NOT NULL REFERENCES public.cms_content(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.cms_categories(id) ON DELETE CASCADE,
  CONSTRAINT cms_content_categories_pkey PRIMARY KEY (content_id, category_id)
);
CREATE INDEX cms_content_categories_category_idx ON public.cms_content_categories (category_id);

CREATE TABLE public.cms_content_tags (
  content_id uuid NOT NULL REFERENCES public.cms_content(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.cms_tags(id) ON DELETE CASCADE,
  CONSTRAINT cms_content_tags_pkey PRIMARY KEY (content_id, tag_id)
);
CREATE INDEX cms_content_tags_tag_idx ON public.cms_content_tags (tag_id);

-- Hand-picked related posts, in order. The public page fills the rest from
-- the same category and shared tags.
CREATE TABLE public.cms_related_content (
  content_id uuid NOT NULL REFERENCES public.cms_content(id) ON DELETE CASCADE,
  related_id uuid NOT NULL REFERENCES public.cms_content(id) ON DELETE CASCADE,
  position smallint NOT NULL DEFAULT 0,
  CONSTRAINT cms_related_content_pkey PRIMARY KEY (content_id, related_id),
  CONSTRAINT cms_related_content_self_check CHECK (content_id <> related_id)
);

-- A guide's chapters, rendered in order on the guide's page. Each has its own
-- body so a long guide saves one section at a time. Position and anchor
-- checks are deferred so a reorder or rename can swap values in one
-- transaction.
CREATE TABLE public.cms_guide_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.cms_content(id) ON DELETE CASCADE,
  position smallint NOT NULL,
  title text NOT NULL DEFAULT '',
  anchor text NOT NULL,
  body jsonb NOT NULL DEFAULT '{"type": "doc", "content": []}'::jsonb,
  body_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cms_guide_sections_pkey PRIMARY KEY (id),
  CONSTRAINT cms_guide_sections_position_key UNIQUE (content_id, position) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT cms_guide_sections_anchor_key UNIQUE (content_id, anchor) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT cms_guide_sections_position_check CHECK (position >= 0),
  CONSTRAINT cms_guide_sections_title_check CHECK (char_length(title) <= 200),
  CONSTRAINT cms_guide_sections_anchor_check CHECK (public.cms_is_valid_slug(anchor)),
  CONSTRAINT cms_guide_sections_body_check CHECK (jsonb_typeof(body) = 'object' AND body->>'type' = 'doc')
);

-- The public copy. Everything the public pages need is denormalised in, so a
-- page is one read: taxonomy as id arrays (GIN-indexed for category, tag and
-- author pages), sections in order, and every image the post shows resolved
-- to its R2 key and size in `assets` ({ "<asset id>": { key, width, height,
-- mime_type } }). Image URLs are built from the key on the web side.
CREATE TABLE public.cms_content_published (
  content_id uuid NOT NULL REFERENCES public.cms_content(id) ON DELETE CASCADE,
  type text NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  excerpt text,
  summary text,
  -- { asset_id, alt, decorative } or null; size and key come from `assets`.
  cover jsonb,
  og_image jsonb,
  body jsonb NOT NULL,
  -- [{ id, title, anchor, body }] in order; [] for blog posts.
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  toc jsonb NOT NULL DEFAULT '[]'::jsonb,
  assets jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_text text NOT NULL DEFAULT '',
  word_count integer NOT NULL,
  reading_time_minutes integer NOT NULL,
  seo_title text,
  seo_description text,
  canonical_url text,
  noindex boolean NOT NULL,
  difficulty text,
  estimated_minutes integer,
  prerequisites jsonb NOT NULL DEFAULT '[]'::jsonb,
  author_ids uuid[] NOT NULL DEFAULT '{}',
  category_ids uuid[] NOT NULL DEFAULT '{}',
  tag_ids uuid[] NOT NULL DEFAULT '{}',
  related_ids uuid[] NOT NULL DEFAULT '{}',
  primary_category_id uuid,
  is_featured boolean NOT NULL,
  pinned_rank smallint,
  comments_enabled boolean NOT NULL,
  first_published_at timestamptz NOT NULL,
  content_updated_at timestamptz NOT NULL,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  search tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english'::regconfig, title), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(summary, '') || ' ' || coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, body_text), 'C')
  ) STORED,
  CONSTRAINT cms_content_published_pkey PRIMARY KEY (content_id),
  CONSTRAINT cms_content_published_slug_key UNIQUE (type, slug),
  CONSTRAINT cms_content_published_type_check CHECK (type IN ('blog', 'guide'))
);

CREATE INDEX cms_content_published_search_idx ON public.cms_content_published USING gin (search);
CREATE INDEX cms_content_published_authors_idx ON public.cms_content_published USING gin (author_ids);
CREATE INDEX cms_content_published_categories_idx ON public.cms_content_published USING gin (category_ids);
CREATE INDEX cms_content_published_tags_idx ON public.cms_content_published USING gin (tag_ids);
CREATE INDEX cms_content_published_list_idx ON public.cms_content_published (type, first_published_at DESC);

-- Point-in-time copies of the working copy (see cms_content_snapshot).
-- Autosaves are coalesced in web-admin to one revision per 10 minutes.
CREATE TABLE public.cms_revisions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.cms_content(id) ON DELETE CASCADE,
  kind text NOT NULL,
  snapshot jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cms_revisions_pkey PRIMARY KEY (id),
  CONSTRAINT cms_revisions_kind_check CHECK (kind IN ('autosave', 'manual', 'publish', 'restore'))
);
CREATE INDEX cms_revisions_content_idx ON public.cms_revisions (content_id, created_at DESC);

-- Old public URLs. Points at the post, not at its new slug, so a slug changed
-- twice still redirects in one hop and chains can't form.
CREATE TABLE public.cms_slug_redirects (
  type text NOT NULL,
  old_slug text NOT NULL,
  content_id uuid NOT NULL REFERENCES public.cms_content(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cms_slug_redirects_pkey PRIMARY KEY (type, old_slug),
  CONSTRAINT cms_slug_redirects_type_check CHECK (type IN ('blog', 'guide'))
);
CREATE INDEX cms_slug_redirects_content_idx ON public.cms_slug_redirects (content_id);

-- Links that show a draft to someone without an admin account. Only the
-- sha256 of the token is stored; the token itself is shown once.
CREATE TABLE public.cms_preview_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.cms_content(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cms_preview_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT cms_preview_tokens_hash_key UNIQUE (token_hash),
  CONSTRAINT cms_preview_tokens_hash_check CHECK (octet_length(token_hash) = 32),
  CONSTRAINT cms_preview_tokens_expiry_check CHECK (expires_at > created_at)
);
CREATE INDEX cms_preview_tokens_content_idx ON public.cms_preview_tokens (content_id, created_at DESC);

CREATE OR REPLACE TRIGGER cms_content_updated_at BEFORE UPDATE ON public.cms_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER cms_guide_sections_updated_at BEFORE UPDATE ON public.cms_guide_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Access ----------------------------------------------------------------------

ALTER TABLE public.cms_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_content_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_content_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_content_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_related_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_guide_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_content_published ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_slug_redirects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_preview_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.cms_content, public.cms_content_authors, public.cms_content_categories, public.cms_content_tags,
  public.cms_related_content, public.cms_guide_sections, public.cms_content_published, public.cms_revisions,
  public.cms_slug_redirects, public.cms_preview_tokens
FROM anon, authenticated;

GRANT ALL ON
  public.cms_content, public.cms_content_authors, public.cms_content_categories, public.cms_content_tags,
  public.cms_related_content, public.cms_guide_sections, public.cms_content_published, public.cms_revisions,
  public.cms_slug_redirects, public.cms_preview_tokens
TO service_role;

-- The public site: every published post, and the redirects of posts that are
-- still published (a redirect to an unpublished post would just 404).
GRANT SELECT ON public.cms_content_published, public.cms_slug_redirects TO anon, authenticated;

CREATE POLICY "Anyone reads published content" ON public.cms_content_published FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone reads redirects of published content" ON public.cms_slug_redirects FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.cms_content_published p WHERE p.content_id = cms_slug_redirects.content_id));
