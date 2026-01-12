-- Create broadcaster_live_status table to track when streamers go live/offline
CREATE TABLE IF NOT EXISTS public.broadcaster_live_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcaster_id TEXT NOT NULL,
    stream_id TEXT,
    
    -- Current live status
    is_live BOOLEAN NOT NULL DEFAULT false,
    
    -- Stream timing
    stream_started_at TIMESTAMPTZ,
    stream_ended_at TIMESTAMPTZ,
    
    -- Stream metadata
    title TEXT,
    category_id TEXT,
    category_name TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure only one record per broadcaster
    CONSTRAINT unique_broadcaster_live_status UNIQUE(broadcaster_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_broadcaster_live_status_broadcaster_id ON public.broadcaster_live_status(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_broadcaster_live_status_is_live ON public.broadcaster_live_status(is_live);
CREATE INDEX IF NOT EXISTS idx_broadcaster_live_status_started_at ON public.broadcaster_live_status(stream_started_at);

-- Create trigger to auto-update updated_at using existing function
CREATE TRIGGER update_broadcaster_live_status_updated_at
    BEFORE UPDATE ON public.broadcaster_live_status
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.broadcaster_live_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for broadcaster_live_status
-- Allow all authenticated users to view live status
CREATE POLICY "Authenticated users can view live status"
    ON public.broadcaster_live_status
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow service role to insert/update/delete
CREATE POLICY "Service role can manage live status"
    ON public.broadcaster_live_status
    FOR ALL
    TO service_role
    USING (true);

-- Comments for documentation
COMMENT ON TABLE public.broadcaster_live_status IS 'Tracks the current live status of broadcasters';
COMMENT ON COLUMN public.broadcaster_live_status.broadcaster_id IS 'Twitch broadcaster ID';
COMMENT ON COLUMN public.broadcaster_live_status.stream_id IS 'Twitch stream ID';
COMMENT ON COLUMN public.broadcaster_live_status.is_live IS 'Current live status of the broadcaster';
COMMENT ON COLUMN public.broadcaster_live_status.stream_started_at IS 'When the current stream started (null if not live)';
COMMENT ON COLUMN public.broadcaster_live_status.stream_ended_at IS 'When the stream ended (set when stream goes offline)';
