"use client";

import { formatDuration } from "@/types/twitch video";
import { getEventTypeInfo } from "@/types/stream-events";
import type { TimelineEvent } from "./types";

interface EventMarkersProps {
  events: TimelineEvent[];
  secondsToPercent: (seconds: number) => number;
  onSeek: (seconds: number) => void;
  onEventClick?: (event: TimelineEvent) => void;
  disabled?: boolean;
}

/**
 * Renders event marker dots on the timeline
 */
export function EventMarkers({ events, secondsToPercent, onSeek, onEventClick, disabled }: EventMarkersProps) {
  const handleEventClick = (e: React.MouseEvent, event: TimelineEvent) => {
    e.stopPropagation();
    if (disabled) return;

    // Seek to event position
    onSeek(event.offset);
    onEventClick?.(event);
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
