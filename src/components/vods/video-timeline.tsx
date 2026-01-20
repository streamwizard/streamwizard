"use client";

import { useCallback, useMemo } from "react";
import { parseDuration, formatDuration } from "@/types/twitch video";
import { getEventTypeInfo, StreamEventType } from "@/types/stream-events";

/**
 * Represents an event on the timeline (e.g., follow, sub, raid)
 */
export interface TimelineEvent {
  id: string;
  /** Offset in seconds from the start of the video */
  offset: number;
  /** Type of event for styling/icons */
  type: StreamEventType;
  /** Display label */
  label: string;
  /** Additional details */
  details?: string;
}

interface VideoTimelineProps {
  /** Total duration of the video in Twitch format (e.g., "1h30m0s") or seconds */
  duration: string | number;
  /** Current playback position in seconds */
  currentTime: number;
  /** List of events to display on the timeline */
  events?: TimelineEvent[];
  /** Called when user clicks on the timeline to seek */
  onSeek: (seconds: number) => void;
  /** Called when user clicks on an event */
  onEventClick?: (event: TimelineEvent) => void;
  /** Whether the timeline is interactive */
  disabled?: boolean;
}

/**
 * Custom video timeline with event markers
 *
 * Features:
 * - Shows current playback position
 * - Displays events as clickable markers
 * - Click anywhere to seek to that position
 * - Hover to see tooltip with time
 */
export function VideoTimeline({
  duration,
  currentTime,
  events = [],
  onSeek,
  onEventClick,
  disabled = false,
}: VideoTimelineProps) {
  // Parse duration to seconds if it's a string
  const totalSeconds = useMemo(() => {
    if (typeof duration === "number") return duration;
    return parseDuration(duration);
  }, [duration]);

  // Calculate progress percentage
  const progressPercent = totalSeconds > 0 ? (currentTime / totalSeconds) * 100 : 0;

  // Handle click on timeline
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || totalSeconds === 0) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percent = clickX / rect.width;
      const seekTime = Math.floor(percent * totalSeconds);
      onSeek(seekTime);
    },
    [disabled, totalSeconds, onSeek],
  );

  // Handle event marker click
  const handleEventClick = useCallback(
    (e: React.MouseEvent, event: TimelineEvent) => {
      e.stopPropagation();
      if (disabled) return;

      // Seek to event position
      onSeek(event.offset);
      onEventClick?.(event);
    },
    [disabled, onSeek, onEventClick],
  );

  return (
    <div className="w-full space-y-2">
      {/* Timeline bar */}
      <div
        className={`relative h-3 w-full rounded-full bg-muted ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        }`}
        onClick={handleTimelineClick}
      >
        {/* Progress bar */}
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-purple-600 transition-all duration-100"
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        />

        {/* Playhead */}
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md transition-all duration-100"
          style={{ left: `${Math.min(progressPercent, 100)}%` }}
        />

        {/* Event markers */}
        {events.map((event) => {
          const eventPercent = totalSeconds > 0 ? (event.offset / totalSeconds) * 100 : 0;
          const info = getEventTypeInfo(event.type);
          return (
            <div
              key={event.id}
              className={`absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full ${
                info.color
              } ring-2 ring-white shadow-md hover:scale-150 transition-transform`}
              style={{ left: `${eventPercent}%` }}
              onClick={(e) => handleEventClick(e, event)}
              title={`${event.label} - ${formatDuration(event.offset)}`}
            />
          );
        })}
      </div>

      {/* Time display */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatDuration(Math.floor(currentTime))}</span>
        <span>{formatDuration(totalSeconds)}</span>
      </div>

      {/* Event legend (only show if there are events) */}
      {events.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-2 text-xs">
          {Object.entries(getEventTypeInfo).map(([type, color]) => {
            const count = events.filter((e) => e.type === type).length;
            if (count === 0) return null;
            return (
              <div key={type} className="flex items-center gap-1">
                <div className={`h-2 w-2 rounded-full ${color}`} />
                <span className="capitalize text-muted-foreground">
                  {type} ({count})
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
