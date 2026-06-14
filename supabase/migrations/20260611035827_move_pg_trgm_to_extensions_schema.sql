-- Ensure pg_trgm lives in the extensions schema.
-- Handles three cases idempotently:
--   1. Extension not installed at all (fresh remote DB) → install into extensions.
--   2. Extension installed in public (local dev after earlier migration) → move it.
--   3. Extension already in extensions → no-op.
-- Fixes advisor 0014_extension_in_public.
DO $$
DECLARE
  ext_schema text;
BEGIN
  SELECT n.nspname INTO ext_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_trgm';

  IF ext_schema IS NULL THEN
    CREATE EXTENSION pg_trgm SCHEMA extensions;
  ELSIF ext_schema <> 'extensions' THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
END;
$$;

-- Ensure the trigram GIN index on clips.title exists.
-- Created locally by an earlier migration; may be absent on remote.
CREATE INDEX IF NOT EXISTS clips_title_trgm_idx
  ON public.clips USING gin (title extensions.gin_trgm_ops);
