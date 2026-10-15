-- CMS (blog posts + guides), part 1: images, categories, tags, authors.
--
-- Admins manage all of this in web-admin with the service-role client. The
-- public site reads with the anon client inside cached functions, so it gets
-- only what a visitor may see: every category and tag, live authors (without
-- their linked account id) and the avatars those authors use. Nothing here is
-- writable by anon or authenticated.
--
-- Slugs share one rule with @repo/cms isValidSlug: lowercase words joined by
-- single dashes, at most 80 characters.

CREATE OR REPLACE FUNCTION public.cms_is_valid_slug(p_slug text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(p_slug) <= 80;
$$;

-- Images uploaded through web-admin (covers, inline images, OG images,
-- avatars). One row per R2 object under cms/; the key embeds the row id, so
-- an object is never overwritten. Pending until the upload is confirmed.
CREATE TABLE public.cms_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  width integer,
  height integer,
  -- Stored on the asset so every place that shows the image has it. A
  -- decorative image gets alt="" on purpose.
  alt text NOT NULL DEFAULT '',
  is_decorative boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cms_assets_pkey PRIMARY KEY (id),
  CONSTRAINT cms_assets_key_key UNIQUE (key),
  CONSTRAINT cms_assets_key_check CHECK (key LIKE 'cms/%'),
  -- No SVG: it can carry script.
  CONSTRAINT cms_assets_mime_check CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif')),
  CONSTRAINT cms_assets_size_check CHECK (size_bytes > 0),
  CONSTRAINT cms_assets_dimensions_check CHECK ((width IS NULL) = (height IS NULL) AND (width IS NULL OR (width > 0 AND height > 0))),
  CONSTRAINT cms_assets_alt_check CHECK (char_length(alt) <= 300),
  CONSTRAINT cms_assets_status_check CHECK (status IN ('pending', 'ready'))
);

-- The reconciler's sweep for uploads that were never confirmed.
CREATE INDEX cms_assets_pending_idx ON public.cms_assets (created_at) WHERE status = 'pending';

CREATE TABLE public.cms_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cms_categories_pkey PRIMARY KEY (id),
  CONSTRAINT cms_categories_slug_key UNIQUE (slug),
  CONSTRAINT cms_categories_slug_check CHECK (public.cms_is_valid_slug(slug)),
  CONSTRAINT cms_categories_name_check CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  CONSTRAINT cms_categories_description_check CHECK (char_length(description) <= 300)
);

CREATE TABLE public.cms_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cms_tags_pkey PRIMARY KEY (id),
  CONSTRAINT cms_tags_slug_key UNIQUE (slug),
  CONSTRAINT cms_tags_slug_check CHECK (public.cms_is_valid_slug(slug)),
  CONSTRAINT cms_tags_name_check CHECK (char_length(btrim(name)) BETWEEN 1 AND 60)
);

-- Who wrote a post. Not tied 1:1 to an account: a guest writer has no
-- user_id. When a linked account is deleted the author page stays (it is
-- editorial content), only the link goes. Authors are soft-deleted so posts
-- that credit them keep resolving; the slug frees up once deleted.
CREATE TABLE public.cms_authors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  slug text NOT NULL,
  name text NOT NULL,
  role_title text,
  bio text,
  avatar_asset_id uuid REFERENCES public.cms_assets(id) ON DELETE SET NULL,
  -- { twitch, x, youtube, bluesky, website }: https URLs, checked in web-admin.
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT cms_authors_pkey PRIMARY KEY (id),
  CONSTRAINT cms_authors_user_id_key UNIQUE (user_id),
  CONSTRAINT cms_authors_slug_check CHECK (public.cms_is_valid_slug(slug)),
  CONSTRAINT cms_authors_name_check CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  CONSTRAINT cms_authors_role_title_check CHECK (char_length(role_title) <= 80),
  CONSTRAINT cms_authors_bio_check CHECK (char_length(bio) <= 600),
  CONSTRAINT cms_authors_social_links_check CHECK (jsonb_typeof(social_links) = 'object')
);

CREATE UNIQUE INDEX cms_authors_slug_key ON public.cms_authors (slug) WHERE deleted_at IS NULL;
CREATE INDEX cms_authors_avatar_idx ON public.cms_authors (avatar_asset_id) WHERE avatar_asset_id IS NOT NULL;

CREATE OR REPLACE TRIGGER cms_assets_updated_at BEFORE UPDATE ON public.cms_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER cms_categories_updated_at BEFORE UPDATE ON public.cms_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER cms_tags_updated_at BEFORE UPDATE ON public.cms_tags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER cms_authors_updated_at BEFORE UPDATE ON public.cms_authors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Access ----------------------------------------------------------------------

ALTER TABLE public.cms_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_authors ENABLE ROW LEVEL SECURITY;

-- Supabase's default privileges hand anon and authenticated everything on a
-- new public table. Take that back, then grant only reads, column by column
-- where a table holds something visitors shouldn't see.
REVOKE ALL ON public.cms_assets, public.cms_categories, public.cms_tags, public.cms_authors FROM anon, authenticated;
GRANT ALL ON public.cms_assets, public.cms_categories, public.cms_tags, public.cms_authors TO service_role;

GRANT SELECT ON public.cms_categories, public.cms_tags TO anon, authenticated;
CREATE POLICY "Anyone reads categories" ON public.cms_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone reads tags" ON public.cms_tags FOR SELECT TO anon, authenticated USING (true);

-- Not user_id: which account an author is linked to is admin business. With
-- column grants, anon queries must name their columns (select=* is refused).
GRANT SELECT (id, slug, name, role_title, bio, avatar_asset_id, social_links, created_at, updated_at, deleted_at)
  ON public.cms_authors TO anon, authenticated;
CREATE POLICY "Anyone reads live authors" ON public.cms_authors FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL);

-- Covers, OG and inline images reach the public site inside the published
-- snapshot (cms_content_published.assets). Avatars are read live, so only an
-- image that a live author uses as avatar is visible: a draft's images stay
-- unlisted even though the CDN would serve them to anyone with the key.
GRANT SELECT (id, key, mime_type, width, height, alt, is_decorative) ON public.cms_assets TO anon, authenticated;
CREATE POLICY "Anyone reads author avatars" ON public.cms_assets FOR SELECT TO anon, authenticated
  USING (
    status = 'ready'
    AND EXISTS (
      SELECT 1 FROM public.cms_authors a
      WHERE a.avatar_asset_id = cms_assets.id AND a.deleted_at IS NULL
    )
  );
