"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { parseDuration, formatDuration } from "@/types/twitch video";
import { getEventTypeInfo, StreamEventType } from "@/types/stream-events";
import { GripVertical, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

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

interface ClipSelection {
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
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
  /** Whether clip creation mode is active */
  isClipMode?: boolean;
  /** Current clip selection (when in clip mode) */
  clipSelection?: ClipSelection;
  /** Called when clip selection changes */
  onClipSelectionChange?: (startTime: number, endTime: number) => void;
  /** Minimum clip duration in seconds (default: 5) */
  minClipDuration?: number;
  /** Maximum clip duration in seconds (default: 60) */
  maxClipDuration?: number;
}

/**
 * Custom video timeline with event markers and optional clip selection
 *
 * Features:
 * - Shows current playback position
 * - Displays events as clickable markers
 * - Click anywhere to seek to that position
 * - Clip mode: Shows draggable brackets for clip selection with zoom
 */
export function VideoTimeline({
  duration,
  currentTime,
  events = [],
  onSeek,
  onEventClick,
  disabled = false,
  isClipMode = false,
  clipSelection,
  onClipSelectionChange,
  minClipDuration = 5,
  maxClipDuration = 60,
}: VideoTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"start" | "end" | "middle" | null>(null);
  const [dragStartInfo, setDragStartInfo] = useState<{ clientX: number; startTime: number; endTime: number } | null>(null);

  // Zoom state for clip mode - represents the visible time window
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = full view, higher = more zoom
  const [viewOffset, setViewOffset] = useState(0); // Offset in seconds from start

  // Parse duration to seconds if it's a string
  const totalSeconds = useMemo(() => {
    if (typeof duration === "number") return duration;
    return parseDuration(duration);
  }, [duration]);

  // Calculate visible time range based on zoom
  const visibleDuration = totalSeconds / zoomLevel;
  const viewStart = viewOffset;
  const viewEnd = Math.min(viewOffset + visibleDuration, totalSeconds);

  // Reset zoom when clip mode changes
  useEffect(() => {
    if (isClipMode && clipSelection) {
      // Center the view on the clip selection with some padding
      const clipCenter = (clipSelection.startTime + clipSelection.endTime) / 2;
      const clipDuration = clipSelection.endTime - clipSelection.startTime;
      // Set zoom to show approximately 5x the clip duration
      const newZoom = Math.max(1, totalSeconds / (clipDuration * 5));
      setZoomLevel(Math.min(newZoom, 20)); // Cap at 20x zoom
      // Center the view on the clip
      const newOffset = Math.max(0, clipCenter - totalSeconds / newZoom / 2);
      setViewOffset(Math.min(newOffset, totalSeconds - totalSeconds / newZoom));
    } else {
      setZoomLevel(1);
      setViewOffset(0);
    }
  }, [isClipMode, totalSeconds]); // Intentionally not including clipSelection to avoid re-centering on every change

  // Convert seconds to percentage within visible range
  const secondsToPercent = useCallback(
    (seconds: number): number => {
      if (visibleDuration === 0) return 0;
      return ((seconds - viewStart) / visibleDuration) * 100;
    },
    [viewStart, visibleDuration],
  );

  // Convert percentage to seconds within visible range
  const percentToSeconds = useCallback(
    (percent: number): number => {
      return viewStart + (percent / 100) * visibleDuration;
    },
    [viewStart, visibleDuration],
  );

  // Calculate progress percentage
  const progressPercent = secondsToPercent(currentTime);

  // Clip selection percentages (clamped to visible range)
  const clipStartPercent = clipSelection ? secondsToPercent(clipSelection.startTime) : 0;
  const clipEndPercent = clipSelection ? secondsToPercent(clipSelection.endTime) : 100;

  // Handle mouse/touch position to seconds
  const getSecondsFromPosition = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      return Math.floor(percentToSeconds(percent));
    },
    [percentToSeconds],
  );

  // Handle clip handle drag
  const handleDrag = useCallback(
    (clientX: number) => {
      if (!dragging || disabled || !clipSelection || !onClipSelectionChange) return;

      if (dragging === "middle" && dragStartInfo) {
        // Move the entire selection
        const deltaX = clientX - dragStartInfo.clientX;
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        const deltaPercent = (deltaX / rect.width) * 100;
        const deltaSeconds = (deltaPercent / 100) * visibleDuration;

        const clipDuration = dragStartInfo.endTime - dragStartInfo.startTime;
        let newStart = dragStartInfo.startTime + deltaSeconds;
        let newEnd = dragStartInfo.endTime + deltaSeconds;

        // Clamp to valid range
        if (newStart < 0) {
          newStart = 0;
          newEnd = clipDuration;
        }
        if (newEnd > totalSeconds) {
          newEnd = totalSeconds;
          newStart = totalSeconds - clipDuration;
        }

        onClipSelectionChange(Math.floor(newStart), Math.floor(newEnd));
      } else {
        const seconds = getSecondsFromPosition(clientX);

        if (dragging === "start") {
          // Ensure start doesn't go past end - minDuration
          const maxStart = Math.max(0, clipSelection.endTime - minClipDuration);
          // Ensure we don't exceed maxDuration from end
          const minStart = Math.max(0, clipSelection.endTime - maxClipDuration);
          const newStart = Math.max(minStart, Math.min(maxStart, seconds));
          onClipSelectionChange(newStart, clipSelection.endTime);
        } else if (dragging === "end") {
          // Ensure end doesn't go before start + minDuration
          const minEnd = Math.min(totalSeconds, clipSelection.startTime + minClipDuration);
          // Ensure we don't exceed maxDuration from start
          const maxEnd = Math.min(totalSeconds, clipSelection.startTime + maxClipDuration);
          const newEnd = Math.max(minEnd, Math.min(maxEnd, seconds));
          onClipSelectionChange(clipSelection.startTime, newEnd);
        }
      }
    },
    [dragging, disabled, clipSelection, onClipSelectionChange, getSecondsFromPosition, minClipDuration, maxClipDuration, totalSeconds, dragStartInfo, visibleDuration],
  );

  // Mouse event handlers for clip dragging
  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleDrag(e.clientX);
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, handleDrag]);

  // Touch event handlers for clip dragging
  useEffect(() => {
    if (!dragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleDrag(e.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      setDragging(null);
    };

    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [dragging, handleDrag]);

  // Handle click on timeline
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || totalSeconds === 0 || dragging) return;

      const seekTime = getSecondsFromPosition(e.clientX);
      onSeek(Math.max(0, Math.min(totalSeconds, seekTime)));
    },
    [disabled, totalSeconds, onSeek, dragging, getSecondsFromPosition],
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

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(zoomLevel * 1.5, 20);
    setZoomLevel(newZoom);
    // Keep the center of the view stable
    if (clipSelection) {
      const clipCenter = (clipSelection.startTime + clipSelection.endTime) / 2;
      const newVisibleDuration = totalSeconds / newZoom;
      const newOffset = Math.max(0, clipCenter - newVisibleDuration / 2);
      setViewOffset(Math.min(newOffset, totalSeconds - newVisibleDuration));
    }
  }, [zoomLevel, clipSelection, totalSeconds]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(zoomLevel / 1.5, 1);
    setZoomLevel(newZoom);
    // Keep the center of the view stable
    if (clipSelection) {
      const clipCenter = (clipSelection.startTime + clipSelection.endTime) / 2;
      const newVisibleDuration = totalSeconds / newZoom;
      const newOffset = Math.max(0, clipCenter - newVisibleDuration / 2);
      setViewOffset(Math.min(newOffset, totalSeconds - newVisibleDuration));
    } else {
      setViewOffset(0);
    }
  }, [zoomLevel, clipSelection, totalSeconds]);

  const clipDuration = clipSelection ? clipSelection.endTime - clipSelection.startTime : 0;

  // Filter events to only show those in visible range
  const visibleEvents = events.filter((event) => event.offset >= viewStart && event.offset <= viewEnd);

  return (
    <div className="w-full space-y-2">
      {/* Zoom controls (only in clip mode) */}
      {isClipMode && (
        <div className="flex items-center justify-end gap-2 mb-2">
          <span className="text-xs text-muted-foreground">Zoom: {zoomLevel.toFixed(1)}x</span>
          <Button variant="outline" size="icon" className="h-6 w-6" onClick={handleZoomOut} disabled={zoomLevel <= 1}>
            <ZoomOut className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="icon" className="h-6 w-6" onClick={handleZoomIn} disabled={zoomLevel >= 20}>
            <ZoomIn className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Timeline bar - always h-8 */}
      <div ref={trackRef} className={`relative h-8 w-full rounded-md overflow-hidden bg-muted ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`} onClick={handleTimelineClick}>
        {/* Progress bar */}
        {progressPercent >= 0 && progressPercent <= 100 && (
          <div className="absolute left-0 top-0 h-full bg-purple-600/60 transition-all duration-100" style={{ width: `${Math.max(0, Math.min(progressPercent, 100))}%` }} />
        )}

        {/* Playhead */}
        {progressPercent >= 0 && progressPercent <= 100 && (
          <div
            className="absolute top-1/2 h-6 w-1 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white shadow-md transition-all duration-100"
            style={{ left: `${Math.max(0, Math.min(progressPercent, 100))}%` }}
          />
        )}

        {/* Clip mode: Darkened areas outside selection */}
        {isClipMode && clipSelection && (
          <>
            {/* Before selection (darker) */}
            {clipStartPercent > 0 && <div className="absolute top-0 bottom-0 left-0 bg-black/50" style={{ width: `${Math.max(0, clipStartPercent)}%` }} />}

            {/* After selection (darker) */}
            {clipEndPercent < 100 && <div className="absolute top-0 bottom-0 right-0 bg-black/50" style={{ width: `${Math.max(0, 100 - clipEndPercent)}%` }} />}

            {/* Start handle */}
            {clipStartPercent >= 0 && clipStartPercent <= 100 && (
              <div
                className={`absolute top-0 bottom-0 w-4 flex items-center justify-center bg-white rounded-sm shadow-lg z-10 ${
                  disabled ? "" : "cursor-ew-resize hover:bg-gray-100"
                } ${dragging === "start" ? "bg-gray-200" : ""}`}
                style={{ left: `calc(${clipStartPercent}% - 8px)` }}
                onMouseDown={(e) => {
                  if (!disabled) {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragging("start");
                  }
                }}
                onTouchStart={(e) => {
                  if (!disabled) {
                    e.preventDefault();
                    setDragging("start");
                  }
                }}
              >
                <GripVertical className="h-4 w-4 text-purple-600" />
              </div>
            )}

            {/* End handle */}
            {clipEndPercent >= 0 && clipEndPercent <= 100 && (
              <div
                className={`absolute top-0 bottom-0 w-4 flex items-center justify-center bg-white rounded-sm shadow-lg z-10 ${
                  disabled ? "" : "cursor-ew-resize hover:bg-gray-100"
                } ${dragging === "end" ? "bg-gray-200" : ""}`}
                style={{ left: `calc(${clipEndPercent}% - 8px)` }}
                onMouseDown={(e) => {
                  if (!disabled) {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragging("end");
                  }
                }}
                onTouchStart={(e) => {
                  if (!disabled) {
                    e.preventDefault();
                    setDragging("end");
                  }
                }}
              >
                <GripVertical className="h-4 w-4 text-purple-600" />
              </div>
            )}
          </>
        )}

        {/* Event markers - adjusted size for h-8 timeline */}
        {visibleEvents.map((event) => {
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
      </div>

      {/* Time display */}
      <div className="flex justify-between text-xs text-muted-foreground">
        {isClipMode && clipSelection ? (
          <>
            <span>{formatDuration(clipSelection.startTime)}</span>
            <span className="text-purple-400">
              Clip: {formatDuration(clipDuration)} ({minClipDuration}s - {maxClipDuration}s)
            </span>
            <span>{formatDuration(clipSelection.endTime)}</span>
          </>
        ) : (
          <>
            <span>{formatDuration(Math.floor(viewStart))}</span>
            <span>{formatDuration(Math.floor(currentTime))}</span>
            <span>{formatDuration(Math.floor(viewEnd))}</span>
          </>
        )}
      </div>

      {/* Event legend (only show if there are events and not in clip mode) */}
      {!isClipMode && events.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-2 text-xs">
          {Object.entries(getEventTypeInfo).map(([type, color]) => {
            const count = events.filter((e) => e.type === type).length;
            if (count === 0) return null;
            return (
              <div key={type} className="flex items-center gap-1">
                <div className={`h-3 w-3 rounded-full ${color}`} />
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
