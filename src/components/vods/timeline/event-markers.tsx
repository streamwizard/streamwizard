"use client";

import { formatDuration } from "@/types/twitch video";
import { getEventTypeInfo } from "@/types/stream-events";
import type { TimelineEvent } from "./types";
import { useVideoDialogStore } from "@/stores/video-dialog-store";

interface EventMarkersProps {
  events: TimelineEvent[];
  secondsToPercent: (seconds: number) => number;
  disabled?: boolean;
}

/**
 * Renders event marker dots on the timeline
 */
export function EventMarkers({ events, secondsToPercent, disabled }: EventMarkersProps) {
  const { seekToEvent } = useVideoDialogStore();

  const handleEventClick = (e: React.MouseEvent, event: TimelineEvent) => {
    e.stopPropagation();
    if (disabled) return;

    // Seek to event position
    seekToEvent(event.id);
  };

  return (
    <>
      {events.map((event) => {
        const eventPercent = secondsToPercent(event.offset);
        if (eventPercent < 0 || eventPercent > 100) return null;
        const info = getEventTypeInfo(event.type);
        return (
          <div
            key={event.id}
            className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full ${info.color} ring-2 ring-white shadow-md hover:scale-150 transition-transform z-20`}
            style={{ left: `${eventPercent}%` }}
            onClick={(e) => handleEventClick(e, event)}
            title={`${event.label} - ${formatDuration(event.offset)}`}
          />
        );
      })}
    </>
  );
}
