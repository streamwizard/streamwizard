"use client";

import { useCallback, useState } from "react";
import { Inbox } from "lucide-react";
import type { ActivityEvent } from "@/actions/supabase/analytics/activity-feed";
import { EVENT_CONFIG, type FilterGroup } from "./eventConfig";
import { ActivityFeedItem } from "./ActivityFeedItem";
import { ActivityFeedRealtimeListener } from "./ActivityFeedRealtimeListener";

const FILTERS: { label: string; value: FilterGroup | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Follows", value: "follows" },
  { label: "Subs", value: "subs" },
  { label: "Bits", value: "bits" },
  { label: "Raids", value: "raids" },
  { label: "Rewards", value: "rewards" },
  { label: "Updates", value: "updates" },
];

interface ActivityFeedClientProps {
  initialEvents: ActivityEvent[];
  streamId: string;
  isLive: boolean;
}

export function ActivityFeedClient({ initialEvents, streamId, isLive }: ActivityFeedClientProps) {
  const [events, setEvents] = useState<ActivityEvent[]>(initialEvents);
  const [activeFilter, setActiveFilter] = useState<FilterGroup | "all">("all");

  const handleNewEvent = useCallback((event: ActivityEvent) => {
    setEvents((prev) => [event, ...prev]);
  }, []);

  const filteredEvents =
    activeFilter === "all"
      ? events
      : events.filter((e) => {
          const config = EVENT_CONFIG[e.event_type];
          return config?.filterGroup === activeFilter;
        });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setActiveFilter(f.value)}
            className={
              "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors " +
              (activeFilter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80")
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="h-80 overflow-y-auto rounded-md border bg-card p-1">
        {filteredEvents.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Inbox className="h-8 w-8" />
            <p className="text-sm">
              {activeFilter === "all"
                ? "No events recorded for this stream"
                : `No ${activeFilter} events for this stream`}
            </p>
          </div>
        ) : (
          filteredEvents.map((event) => <ActivityFeedItem key={event.id} event={event} />)
        )}
      </div>

      {isLive && (
        <ActivityFeedRealtimeListener streamId={streamId} onNewEvent={handleNewEvent} />
      )}
    </div>
  );
}
