-- Tracks one IRL session per stream.
-- The WS server writes to this table; the widget reads from it.

CREATE TABLE irl_sessions (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  twitch_stream_id      text        NOT NULL,          -- Twitch stream ID (changes every stream)
  subscriber_token      text        NOT NULL UNIQUE,   -- links back to the overlay scene
  total_distance_meters float       NOT NULL DEFAULT 0,
  last_lat              float,                         -- last known position for delta calc
  last_lng              float,
  started_at            timestamptz NOT NULL DEFAULT now(),
  ended_at              timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Public read (widget iframe can fetch without auth).
-- Write is service-role only (WS server uses service key).
ALTER TABLE irl_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read by subscriber_token"
  ON irl_sessions FOR SELECT
  USING (true);                   -- anyone with the token can read; token is the secret

-- Index for the widget fetch and WS server upsert.
CREATE INDEX ON irl_sessions (subscriber_token);
CREATE INDEX ON irl_sessions (twitch_stream_id);
