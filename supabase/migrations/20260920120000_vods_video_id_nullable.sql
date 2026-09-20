-- vods is the per-stream row. stream.online now inserts it even when Twitch
-- has no archive video for the stream yet (VODs turned off, or Helix listing
-- the archive a few minutes after go-live). video_id is filled in later by the
-- viewer poller and once more on stream.offline.
--
-- vods_video_id_key stays UNIQUE: NULLs are distinct in Postgres, so any number
-- of VOD-less streams can coexist while a real video id still cannot repeat.

ALTER TABLE "public"."vods" ALTER COLUMN "video_id" DROP NOT NULL;

ALTER TABLE "public"."vods"
  ADD CONSTRAINT "vods_video_id_or_stream_id_check"
  CHECK ("video_id" IS NOT NULL OR "stream_id" IS NOT NULL);
