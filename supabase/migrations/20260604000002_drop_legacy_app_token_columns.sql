-- Drop legacy plaintext columns replaced by encrypted equivalents (access_token_ciphertext/iv/tag).
ALTER TABLE public.twitch_app_token DROP COLUMN IF EXISTS access_token;
ALTER TABLE public.twitch_app_token DROP COLUMN IF EXISTS token_type;
