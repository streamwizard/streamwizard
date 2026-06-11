-- Enable pg_trgm for efficient ILIKE substring search on title
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index for title substring search (ilike '%query%')
CREATE INDEX IF NOT EXISTS clips_title_trgm_idx ON public.clips USING gin (title gin_trgm_ops);

-- Index for date range filtering and default sort
CREATE INDEX IF NOT EXISTS clips_created_at_twitch_idx ON public.clips USING btree (created_at_twitch DESC);

-- Partial index for featured-only filter
CREATE INDEX IF NOT EXISTS clips_is_featured_idx ON public.clips (id) WHERE is_featured = true;

-- Index for user_id scope fallback
CREATE INDEX IF NOT EXISTS clips_user_id_idx ON public.clips USING btree (user_id);
