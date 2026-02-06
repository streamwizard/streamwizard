"use client";

import { StreamEvent } from "@/types/stream-events";
import { getStreamEventDisplayInfo } from "@/lib/utils/stream-events";
import { formatDuration } from "@/types/twitch video";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useVideoDialogStore } from "@/stores/video-dialog-store";

/**
 * Panel displaying stream events in a scrollable list
 * Events are clickable to seek to that point in the video
 *
 * Now uses the video dialog store for currentTime and event handling.
 * Events are still passed as props for filtering flexibility.
 */

export function StreamEventsPanel() {
  const { isLoadingEvents, currentTime, seekToEvent, filteredEvents } = useVideoDialogStore();

  const handleEventClick = (event: StreamEvent) => {
    seekToEvent(event.id);
  };

  if (isLoadingEvents) {
    return (
      <div className="space-y-3 p-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Stream Events</h3>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (filteredEvents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-center text-sm text-muted-foreground">No events recorded for this stream or no filters are selected</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b px-4 py-3 shrink-0">
        <h3 className="text-sm font-semibold">
          Stream Events
          <Badge variant="secondary" className="ml-2">
            {filteredEvents.length}
          </Badge>
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-1 p-2">
          {filteredEvents.map((event) => {
            const info = getStreamEventDisplayInfo(event);
            const offsetSeconds = (event.offset_seconds as number) || 0;
            const isPast = currentTime >= offsetSeconds;

            return (
              <button key={event.id} onClick={() => handleEventClick(event)} className={`w-full rounded-lg p-3 text-left transition-colors hover:bg-muted/50 ${isPast ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-3">
                  {/* Event icon */}
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${info.color} text-white`}>
                    <info.icon className="h-4 w-4" />
                  </div>

                  {/* Event details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{info.label}</span>
                      <span className="text-xs text-muted-foreground">{formatDuration(offsetSeconds)}</span>
                    </div>
                    {info.subtitle && <p className="text-xs text-muted-foreground/80 truncate">{info.subtitle}</p>}
                    {info.userName && <p className="text-sm text-muted-foreground truncate">{info.userName}</p>}
                    {info.message && <p className="text-xs text-muted-foreground truncate mt-0.5">{info.message}</p>}
                    {info.amount && <p className="text-xs font-medium text-green-500 mt-0.5">{info.amount}</p>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
