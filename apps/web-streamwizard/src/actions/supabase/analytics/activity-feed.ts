"use server";

import { cache } from "react";
import { createClient } from "@repo/supabase/next/server";
import { getActivityFeedEvents } from "@repo/supabase/queries/stream-analytics";

export interface ActivityEvent {
  id: string;
  event_type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event_data: any;
  created_at: string;
  offset_seconds: number;
}

export const getActivityFeedData = cache(
  async (streamId: string, broadcasterId: string): Promise<ActivityEvent[]> => {
    const supabase = await createClient();
    const events = await getActivityFeedEvents(supabase, streamId, broadcasterId);
    return events.map((e) => ({
      id: e.id,
      event_type: e.event_type,
      event_data: e.event_data,
      created_at: e.created_at,
      offset_seconds: e.offset_seconds,
    }));
  }
);
