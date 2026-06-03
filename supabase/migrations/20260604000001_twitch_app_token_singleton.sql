-- The plaintext access_token and token_type columns are legacy (replaced by encrypted columns).
-- Make them nullable so upsert doesn't require them.
ALTER TABLE public.twitch_app_token ALTER COLUMN access_token DROP NOT NULL;
ALTER TABLE public.twitch_app_token ALTER COLUMN token_type DROP NOT NULL;

-- Add a singleton constraint so the table can only ever hold one row and upsert works reliably.
ALTER TABLE public.twitch_app_token ADD COLUMN IF NOT EXISTS singleton TEXT NOT NULL DEFAULT 'singleton';
ALTER TABLE public.twitch_app_token ADD CONSTRAINT twitch_app_token_singleton_unique UNIQUE (singleton);
