"use client";

import { useEffect } from "react";
import { createBrowserClient } from "@repo/supabase/next/client";
import type { ActivityEvent } from "@/actions/supabase/analytics/activity-feed";

interface ActivityFeedRealtimeListenerProps {
  streamId: string;
  onNewEvent: (event: ActivityEvent) => void;
}

export function ActivityFeedRealtimeListener({
  streamId,
  onNewEvent,
}: ActivityFeedRealtimeListenerProps) {
  useEffect(() => {
    const supabase = createBrowserClient();

    const channel = supabase
      .channel(`stream_events_feed_${streamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "stream_events",
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          onNewEvent(payload.new as ActivityEvent);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, onNewEvent]);

  return null;
}
