-- Fonts in the media library (SW-241): .woff and .woff2 files a streamer
-- uploads for overlay text. Overlays load them with @font-face from the CDN.
ALTER TABLE public.user_assets DROP CONSTRAINT user_assets_kind_check;
ALTER TABLE public.user_assets
  ADD CONSTRAINT user_assets_kind_check
  CHECK (kind IN ('image', 'audio', 'video', 'lottie', 'font'));
