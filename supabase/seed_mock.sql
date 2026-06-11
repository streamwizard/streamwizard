-- Mock seed data for local development
-- User: jochemwhite | broadcaster_id: 122604941 | user_id: 1b864b26-15ed-44fa-a58d-8fae601d3de9

DO $$
DECLARE
  v_user_id        uuid := '1b864b26-15ed-44fa-a58d-8fae601d3de9';
  v_integration_id uuid := 'b8fcef0b-4f79-4014-81e7-f98b619ba904';
  v_broadcaster    text := '122604941';
  v_stream1_id    text        := 'mock_stream_48291730';
  v_vod1_id       text        := 'mock_vod_2298471';
  v_stream1_start timestamptz := now() - interval '2 days';
BEGIN

-- ─── Guard: skip if already seeded ───────────────────────────────────────
IF EXISTS (SELECT 1 FROM public.broadcaster_live_status WHERE stream_id = v_stream1_id) THEN
  RAISE NOTICE 'Mock data already exists, skipping.';
  RETURN;
END IF;

-- ─── Twitch integration / profile ─────────────────────────────────────────
INSERT INTO public.integrations_twitch (
  id, user_id, twitch_username, twitch_user_id,
  profile_image_url, broadcaster_type, description
) VALUES (
  v_integration_id, v_user_id, 'jochemwhite', v_broadcaster,
  'https://static-cdn.jtvnw.net/jtv_user_pictures/096a598b-3903-4c07-b91a-7ec9c142f838-profile_image-300x300.png',
  'affiliate', 'Building stuff and streaming it.'
)
ON CONFLICT (twitch_user_id) DO NOTHING;

-- ─── Stream (one row per broadcaster — unique constraint on broadcaster_id) ─
INSERT INTO public.broadcaster_live_status (
  broadcaster_id, broadcaster_name, stream_id, is_live,
  stream_started_at, stream_ended_at, title, category_id, category_name
) VALUES
  (v_broadcaster, 'jochemwhite', v_stream1_id, false,
   v_stream1_start, v_stream1_start + interval '3 hours',
   '!discord | building a clip manager in Next.js 🔨', '1469308723', 'Software and Game Development')
ON CONFLICT (broadcaster_id) DO UPDATE SET
  stream_id        = EXCLUDED.stream_id,
  stream_started_at = EXCLUDED.stream_started_at,
  stream_ended_at  = EXCLUDED.stream_ended_at,
  title            = EXCLUDED.title,
  category_id      = EXCLUDED.category_id,
  category_name    = EXCLUDED.category_name,
  is_live          = EXCLUDED.is_live;

-- ─── VOD ──────────────────────────────────────────────────────────────────
INSERT INTO public.vods (stream_id, video_id, broadcaster_id, started_at)
VALUES (v_stream1_id, v_vod1_id, v_broadcaster, v_stream1_start);

-- ─── Viewer counts — stream 1 (every 5 min, 36 buckets = 3 h) ────────────
INSERT INTO public.stream_viewer_counts
  (stream_id, broadcaster_id, viewer_count, offset_seconds, game_id, game_name, title)
SELECT
  v_stream1_id, v_broadcaster,
  GREATEST(10, CASE
    WHEN b <= 6  THEN (40  + b * 25)::int
    WHEN b <= 18 THEN (190 + (b - 6)  * 12 + (random()*15)::int)
    WHEN b <= 24 THEN (340 - (b - 18) * 8  + (random()*20)::int)
    ELSE              (290 - (b - 24) * 18 + (random()*15)::int)
  END),
  b * 300, '1469308723', 'Software and Game Development',
  '!discord | building a clip manager in Next.js 🔨'
FROM generate_series(0, 35) AS b;


-- ─── Stream events — stream 1 ─────────────────────────────────────────────
INSERT INTO public.stream_events (broadcaster_id, stream_id, event_type, provider, offset_seconds, event_data) VALUES
  (v_broadcaster, v_stream1_id, 'stream.online',   'twitch', 0,    '{"type":"live"}'),
  (v_broadcaster, v_stream1_id, 'channel.update',  'twitch', 60,   '{"title":"!discord | building a clip manager in Next.js 🔨","category_name":"Software and Game Development"}'),
  (v_broadcaster, v_stream1_id, 'channel.subscribe','twitch', 1240, '{"user_name":"PogViewer42","tier":"1000","is_gift":false}'),
  (v_broadcaster, v_stream1_id, 'channel.subscribe','twitch', 2810, '{"user_name":"CodeMonkey99","tier":"1000","is_gift":false}'),
  (v_broadcaster, v_stream1_id, 'channel.subscribe','twitch', 4200, '{"user_name":"NightOwlDev","tier":"2000","is_gift":false}'),
  (v_broadcaster, v_stream1_id, 'channel.subscribe','twitch', 5600, '{"user_name":"SleeplessHacker","tier":"1000","is_gift":true}'),
  (v_broadcaster, v_stream1_id, 'channel.subscribe','twitch', 6900, '{"user_name":"ByteWrangler","tier":"1000","is_gift":false}'),
  (v_broadcaster, v_stream1_id, 'channel.subscription.message','twitch', 3480, '{"user_name":"LegacyLurker","cumulative_months":7,"message":{"text":"7 months lets gooo"}}'),
  (v_broadcaster, v_stream1_id, 'channel.subscription.message','twitch', 7200, '{"user_name":"TerminalTed","cumulative_months":3,"message":{"text":"keep shipping 🔥"}}'),
  (v_broadcaster, v_stream1_id, 'channel.cheer',   'twitch', 2100, '{"user_name":"BitDropper","bits":100}'),
  (v_broadcaster, v_stream1_id, 'channel.cheer',   'twitch', 5400, '{"user_name":"anonymous","bits":500,"is_anonymous":true}'),
  (v_broadcaster, v_stream1_id, 'channel.raid',    'twitch', 8400, '{"from_broadcaster_name":"DevStreamCo","viewer_count":47}'),
  (v_broadcaster, v_stream1_id, 'channel.ad_break.begin','twitch', 5400, '{"duration_seconds":90}'),
  (v_broadcaster, v_stream1_id, 'stream.offline',  'twitch', 10800,'{}');

-- follows for stream 1
INSERT INTO public.stream_events (broadcaster_id, stream_id, event_type, provider, offset_seconds, event_data)
SELECT v_broadcaster, v_stream1_id, 'channel.follow', 'twitch',
  300 + i * 180,
  jsonb_build_object('user_name', 'viewer_' || i, 'user_id', (1000 + i)::text)
FROM generate_series(1, 22) AS i;

-- channel points for stream 1
INSERT INTO public.stream_events (broadcaster_id, stream_id, event_type, provider, offset_seconds, event_data)
SELECT v_broadcaster, v_stream1_id,
  'channel.channel_points_custom_reward_redemption.add', 'twitch',
  600 + i * 300,
  jsonb_build_object('user_name', 'chatter_' || i, 'reward', jsonb_build_object('title', 'Hydrate!', 'cost', 100))
FROM generate_series(1, 8) AS i;


-- ─── Clips for VOD 1 ──────────────────────────────────────────────────────
INSERT INTO public.clips (
  twitch_clip_id, title, creator_name, broadcaster_name, broadcaster_id,
  creator_id, url, thumbnail_url, video_id, view_count, duration,
  vod_offset, created_at_twitch, user_id, is_featured
) VALUES
  ('mock_clip_001', 'when the compiler just gives up', 'PogViewer42', 'jochemwhite', v_broadcaster,
   '900001', 'https://clips.twitch.tv/mock_clip_001',
   'https://clips-media-assets2.twitch.tv/AT-cm%7C2038847261-preview-480x272.jpg',
   v_vod1_id, 847, 28.4, 3600, v_stream1_start + interval '60 minutes', v_user_id, true),

  ('mock_clip_002', 'accidental delete in prod (local) 💀', 'CodeMonkey99', 'jochemwhite', v_broadcaster,
   '900002', 'https://clips.twitch.tv/mock_clip_002',
   'https://clips-media-assets2.twitch.tv/AT-cm%7C2038847262-preview-480x272.jpg',
   v_vod1_id, 412, 19.0, 5400, v_stream1_start + interval '90 minutes', v_user_id, false),

  ('mock_clip_003', 'it works and I have no idea why', 'NightOwlDev', 'jochemwhite', v_broadcaster,
   '900003', 'https://clips.twitch.tv/mock_clip_003',
   'https://clips-media-assets2.twitch.tv/AT-cm%7C2038847263-preview-480x272.jpg',
   v_vod1_id, 293, 22.1, 7200, v_stream1_start + interval '120 minutes', v_user_id, false),

  ('mock_clip_004', 'explaining async/await for the 4th time this stream', 'ByteWrangler', 'jochemwhite', v_broadcaster,
   '900004', 'https://clips.twitch.tv/mock_clip_004',
   'https://clips-media-assets2.twitch.tv/AT-cm%7C2038847264-preview-480x272.jpg',
   v_vod1_id, 188, 34.7, 9000, v_stream1_start + interval '150 minutes', v_user_id, false),

  ('mock_clip_005', 'raid incoming 47 people WutFace', 'LegacyLurker', 'jochemwhite', v_broadcaster,
   '900005', 'https://clips.twitch.tv/mock_clip_005',
   'https://clips-media-assets2.twitch.tv/AT-cm%7C2038847265-preview-480x272.jpg',
   v_vod1_id, 156, 15.2, 8400, v_stream1_start + interval '140 minutes', v_user_id, false);

RAISE NOTICE 'Mock data inserted successfully.';
END $$;
