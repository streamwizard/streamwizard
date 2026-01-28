"use client";

import { useCallback, useMemo, useRef, useEffect } from "react";
import { parseDuration, formatDuration } from "@/types/twitch video";
import { getEventTypeInfo, StreamEventType } from "@/types/stream-events";
import { GripVertical, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVideoDialogStore } from "@/stores/video-dialog-store";

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

/** Represents a muted segment in the video */
export interface MutedSegment {
  /** Duration of the muted segment in seconds */
  duration: number;
  /** Offset in seconds from the start of the video */
  offset: number;
}

interface VideoTimelineProps {
  /** Total duration of the video in Twitch format (e.g., "1h30m0s") or seconds */
  duration: string | number;
  /** Current playback position in seconds */
  currentTime: number;
  /** List of events to display on the timeline */
  events?: TimelineEvent[];
  /** Muted segments to display on the timeline */
  mutedSegments?: MutedSegment[] | null;
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
  mutedSegments,
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

  // Get timeline state and actions from store
  const { zoomLevel, viewOffset, dragging, dragStartInfo, setZoomLevel, setViewOffset, zoomIn, zoomOut, setDragging, setDragStartInfo, initializeZoomForClip, resetZoom } = useVideoDialogStore();

  // Track when we just finished dragging to prevent click from firing
  const justFinishedDraggingRef = useRef(false);
  // Track if actual movement occurred during drag (to distinguish click from drag)
  const hasDraggedRef = useRef(false);

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
      initializeZoomForClip();
    } else {
      resetZoom();
    }
  }, [isClipMode]); // Only trigger on mode change

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
      hasDraggedRef.current = true;
      handleDrag(e.clientX);
    };

    const handleMouseUp = () => {
      // Only block the click if we actually moved during the drag
      if (hasDraggedRef.current) {
        justFinishedDraggingRef.current = true;
        // Reset the flag after a brief delay (click event fires after mouseup)
        setTimeout(() => {
          justFinishedDraggingRef.current = false;
        }, 0);
      }
      hasDraggedRef.current = false;
      setDragging(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, handleDrag, setDragging]);

  // Touch event handlers for clip dragging
  useEffect(() => {
    if (!dragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleDrag(e.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      // Set flag before clearing dragging state to prevent click from firing
      justFinishedDraggingRef.current = true;
      setDragging(null);
      // Reset the flag after a brief delay
      setTimeout(() => {
        justFinishedDraggingRef.current = false;
      }, 0);
    };

    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [dragging, handleDrag, setDragging]);

  // Wheel event handler for Shift + scroll zoom
  useEffect(() => {
    if (!trackRef.current) return;

    const handleWheel = (e: WheelEvent) => {
      // Only zoom if Shift is held
      if (!e.shiftKey) return;

      e.preventDefault();

      // Determine zoom direction: negative deltaY = scroll up = zoom in
      const zoomInDirection = e.deltaY < 0;
      const zoomFactor = 1.2;

      const newZoom = zoomInDirection ? Math.min(zoomLevel * zoomFactor, 20) : Math.max(zoomLevel / zoomFactor, 1);

      setZoomLevel(newZoom);

      // Keep the center of the view stable
      const centerPoint = clipSelection ? (clipSelection.startTime + clipSelection.endTime) / 2 : currentTime;

      const newVisibleDuration = totalSeconds / newZoom;
      const newOffset = Math.max(0, centerPoint - newVisibleDuration / 2);
      setViewOffset(newZoom === 1 ? 0 : Math.min(newOffset, totalSeconds - newVisibleDuration));
    };

    const element = trackRef.current;
    element.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      element.removeEventListener("wheel", handleWheel);
    };
  }, [zoomLevel, clipSelection, totalSeconds, currentTime, setZoomLevel, setViewOffset]);

  // Handle click on timeline
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Prevent click from firing if we just finished dragging
      if (disabled || totalSeconds === 0 || dragging || justFinishedDraggingRef.current) {
        return;
      }

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
    const centerPoint = clipSelection ? (clipSelection.startTime + clipSelection.endTime) / 2 : currentTime;
    zoomIn(centerPoint);
  }, [clipSelection, currentTime, zoomIn]);

  const handleZoomOut = useCallback(() => {
    const centerPoint = clipSelection ? (clipSelection.startTime + clipSelection.endTime) / 2 : currentTime;
    zoomOut(centerPoint);
  }, [clipSelection, currentTime, zoomOut]);

  const clipDuration = clipSelection ? clipSelection.endTime - clipSelection.startTime : 0;

  // Filter events to only show those in visible range
  const visibleEvents = events.filter((event) => event.offset >= viewStart && event.offset <= viewEnd);

  return (
    <div className="w-full space-y-2">
      {/* Zoom controls */}
      <div className="flex items-center justify-end gap-2 mb-2">
        <span className="text-xs text-muted-foreground">Zoom: {zoomLevel.toFixed(1)}x</span>
        <Button variant="outline" size="icon" className="h-6 w-6" onClick={handleZoomOut} disabled={zoomLevel <= 1}>
          <ZoomOut className="h-3 w-3" />
        </Button>
        <Button variant="outline" size="icon" className="h-6 w-6" onClick={handleZoomIn} disabled={zoomLevel >= 20}>
          <ZoomIn className="h-3 w-3" />
        </Button>
      </div>

      {/* Timestamp ruler above timeline */}
      <div className="relative w-full h-5 mb-1">
        {useMemo(() => {
          // Calculate appropriate interval based on visible duration
          // We want approximately 16 timestamps visible at any time
          const targetTimestampCount = 16;
          const rawInterval = visibleDuration / targetTimestampCount;

          // Round to nice intervals: 1s, 5s, 10s, 15s, 30s, 1m, 2m, 5m, 10m, 15m, 30m, 1h, etc.
          const niceIntervals = [1, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400];
          let interval = niceIntervals.find((i) => i >= rawInterval) || niceIntervals[niceIntervals.length - 1];

          // Generate timestamps
          const timestamps: { time: number; percent: number }[] = [];
          const firstTimestamp = Math.ceil(viewStart / interval) * interval;

          for (let time = firstTimestamp; time <= viewEnd; time += interval) {
            const percent = secondsToPercent(time);
            if (percent >= 0 && percent <= 100) {
              timestamps.push({ time, percent });
            }
          }

          return timestamps.map(({ time, percent }) => (
            <div key={time} className="absolute top-0 flex flex-col items-center" style={{ left: `${percent}%`, transform: "translateX(-50%)" }}>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDuration(Math.floor(time))}</span>
              <div className="w-px h-1 bg-muted-foreground/40" />
            </div>
          ));
        }, [viewStart, viewEnd, visibleDuration, secondsToPercent])}
      </div>

      {/* Timeline bar - always h-8 */}
      <div ref={trackRef} className={`relative h-8 w-full rounded-md overflow-hidden bg-muted ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`} onClick={handleTimelineClick}>
        {/* Progress bar */}
        {progressPercent >= 0 && progressPercent <= 100 && (
          <div className="absolute left-0 top-0 h-full bg-purple-600/60 transition-all duration-100" style={{ width: `${Math.max(0, Math.min(progressPercent, 100))}%` }} />
        )}

        {/* Muted segments - red indicators */}
        {mutedSegments?.map((segment, index) => {
          const segmentStart = segment.offset;
          const segmentEnd = segment.offset + segment.duration;
          const startPercent = secondsToPercent(segmentStart);
          const endPercent = secondsToPercent(segmentEnd);

          // Only render if at least partially visible
          if (endPercent < 0 || startPercent > 100) return null;

          const clampedStart = Math.max(0, startPercent);
          const clampedEnd = Math.min(100, endPercent);
          const width = clampedEnd - clampedStart;

          return (
            <div
              key={`muted-${index}`}
              className="absolute top-0 bottom-0 bg-red-500/40 border-l border-r border-red-600/60"
              style={{
                left: `${clampedStart}%`,
                width: `${width}%`,
                backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(239, 68, 68, 0.2) 4px, rgba(239, 68, 68, 0.2) 8px)",
              }}
              title={`Muted: ${formatDuration(segment.offset)} - ${formatDuration(segmentEnd)}`}
            />
          );
        })}

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

            {/* Middle draggable area - allows moving the entire selection */}
            {clipStartPercent >= -10 && clipEndPercent <= 110 && (
              <div
                className={`absolute top-0 bottom-0 bg-purple-500/20 border-t-2 border-b-2 border-purple-500/50 ${
                  disabled ? "" : "cursor-grab hover:bg-purple-500/30"
                } ${dragging === "middle" ? "cursor-grabbing bg-purple-500/40" : ""}`}
                style={{
                  left: `${Math.max(0, clipStartPercent)}%`,
                  width: `${Math.min(100, clipEndPercent) - Math.max(0, clipStartPercent)}%`,
                }}
                onMouseDown={(e) => {
                  if (!disabled && clipSelection) {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragging("middle");
                    setDragStartInfo({
                      clientX: e.clientX,
                      startTime: clipSelection.startTime,
                      endTime: clipSelection.endTime,
                    });
                  }
                }}
                onTouchStart={(e) => {
                  if (!disabled && clipSelection && e.touches.length > 0) {
                    e.preventDefault();
                    setDragging("middle");
                    setDragStartInfo({
                      clientX: e.touches[0].clientX,
                      startTime: clipSelection.startTime,
                      endTime: clipSelection.endTime,
                    });
                  }
                }}
              />
            )}

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

      {/* Legend - shows what each element represents */}
      <div className="flex flex-wrap gap-3 pt-2 text-xs border-t mt-2 pt-3">
        {/* Progress & Playhead */}
        <div className="flex items-center gap-1">
          <div className="h-3 w-4 bg-purple-600/60 rounded-sm" />
          <span className="text-muted-foreground">Progress</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-1 bg-white rounded-sm shadow" />
          <span className="text-muted-foreground">Playhead</span>
        </div>

        {/* Muted segments (if any) */}
        {mutedSegments && mutedSegments.length > 0 && (
          <div className="flex items-center gap-1">
            <div
              className="h-3 w-4 bg-red-500/40 border border-red-600/60 rounded-sm"
              style={{
                backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(239, 68, 68, 0.2) 2px, rgba(239, 68, 68, 0.2) 4px)",
              }}
            />
            <span className="text-muted-foreground">Muted ({mutedSegments.length})</span>
          </div>
        )}

        {/* Clip selection (when in clip mode) */}
        {isClipMode && (
          <div className="flex items-center gap-1">
            <div className="h-3 w-4 bg-purple-500/20 border border-purple-500/50 rounded-sm" />
            <span className="text-muted-foreground">Clip Selection</span>
          </div>
        )}

        {/* Event markers */}
        {events.length > 0 && (
          <>
            <div className="h-3 w-px bg-border" />
            {Object.entries(getEventTypeInfo).map(([type, info]) => {
              const count = events.filter((e) => e.type === type).length;
              if (count === 0) return null;
              return (
                <div key={type} className="flex items-center gap-1">
                  <div className={`h-3 w-3 rounded-full ${info.color} ring-1 ring-white`} />
                  <span className="capitalize text-muted-foreground">
                    {type} ({count})
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
