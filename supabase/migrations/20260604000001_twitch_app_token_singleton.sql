DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'twitch_app_token' AND column_name = 'access_token') THEN
    ALTER TABLE public.twitch_app_token ALTER COLUMN access_token DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'twitch_app_token' AND column_name = 'token_type') THEN
    ALTER TABLE public.twitch_app_token ALTER COLUMN token_type DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE public.twitch_app_token ADD COLUMN IF NOT EXISTS singleton TEXT NOT NULL DEFAULT 'singleton';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'twitch_app_token_singleton_unique') THEN
    ALTER TABLE public.twitch_app_token ADD CONSTRAINT twitch_app_token_singleton_unique UNIQUE (singleton);
  END IF;
END $$;
