"use client";

import { useRef, useEffect, useState } from "react";
import { parseDuration } from "@/types/twitch video";
import { useVideoPlayerStore } from "@/stores/video-dialog-store";
import { secondsToPercent as toPercent, getSecondsFromPosition } from "./timeline-utils";
import { ZoomControls } from "./zoom-controls";
import { TimelineRuler } from "./timeline-ruler";
import { MutedSegments } from "./muted-segments";
import { ClipSelection } from "./clip-selection";
import { EventMarkers } from "./event-markers";
import { TimelineDisplay } from "./timeline-display";
import { TimelineLegend } from "./timeline-legend";
import { TimelineContextMenu } from "./timeline-context-menu";
import type { VideoTimelineProps, ClipSelection as ClipSelectionType } from "./types";

// Re-export types for consumers
export type { TimelineEvent, ClipSelection as ClipSelectionType, MutedSegment, VideoTimelineProps } from "./types";

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
  events: eventsProp,
  mutedSegments,
  disabled = false,
  isClipMode = false,
  clipSelection,
  onClipSelectionChange,
  minClipDuration = 5,
  maxClipDuration = 60,
}: VideoTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  // Use events from store if not provided via props
  const storeEvents = useVideoPlayerStore((state) => state.timelineEvents);
  const events = eventsProp ?? storeEvents;
  const { seek, setZoomLevel, viewOffset, zoomLevel, dragging, dragStartInfo, setViewOffset, setDragging, initializeZoomForClip, resetZoom } = useVideoPlayerStore();

  // Local state for drag position - prevents re-renders via Zustand during drag
  // This is updated via refs and DOM manipulation, only committed on drag end
  const [localClipSelection, setLocalClipSelection] = useState<ClipSelectionType | null>(null);
  const pendingSelectionRef = useRef<ClipSelectionType | null>(null);

  // Track when we just finished dragging to prevent click from firing
  const justFinishedDraggingRef = useRef(false);
  // Track if actual movement occurred during drag (to distinguish click from drag)
  const hasDraggedRef = useRef(false);

  // Parse duration to seconds if it's a string
  const totalSeconds = typeof duration === "number" ? duration : parseDuration(duration);

  // Calculate visible time range based on zoom
  const visibleDuration = totalSeconds / zoomLevel;
  const viewStart = viewOffset;
  const viewEnd = Math.min(viewOffset + visibleDuration, totalSeconds);

  // Helper functions (no hooks needed with React Compiler)
  const secondsToPercent = (seconds: number): number => {
    return toPercent(seconds, viewStart, visibleDuration);
  };

  // Reset zoom when clip mode changes
  useEffect(() => {
    if (isClipMode && clipSelection) {
      initializeZoomForClip();
    } else {
      resetZoom();
    }
  }, [isClipMode]); // Only trigger on mode change

  // Sync local selection when dragging starts
  useEffect(() => {
    if (dragging && clipSelection) {
      setLocalClipSelection({ ...clipSelection });
      pendingSelectionRef.current = { ...clipSelection };
    } else if (!dragging) {
      setLocalClipSelection(null);
      pendingSelectionRef.current = null;
    }
  }, [dragging, clipSelection]);

  // Handle clip handle drag - updates local state only (no Zustand = no re-render)
  const handleDrag = (clientX: number) => {
    if (!dragging || disabled || !clipSelection || !onClipSelectionChange) return;

    const currentSelection = pendingSelectionRef.current || clipSelection;

    let newStart = currentSelection.startTime;
    let newEnd = currentSelection.endTime;

    if (dragging === "middle" && dragStartInfo) {
      // Move the entire selection
      const deltaX = clientX - dragStartInfo.clientX;
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const deltaPercent = (deltaX / rect.width) * 100;
      const deltaSeconds = (deltaPercent / 100) * visibleDuration;

      const clipDuration = dragStartInfo.endTime - dragStartInfo.startTime;
      newStart = dragStartInfo.startTime + deltaSeconds;
      newEnd = dragStartInfo.endTime + deltaSeconds;

      // Clamp to valid range
      if (newStart < 0) {
        newStart = 0;
        newEnd = clipDuration;
      }
      if (newEnd > totalSeconds) {
        newEnd = totalSeconds;
        newStart = totalSeconds - clipDuration;
      }
    } else {
      const seconds = getSecondsFromPosition(clientX, trackRef.current, viewStart, visibleDuration);

      if (dragging === "start") {
        // Ensure start doesn't go past end - minDuration
        const maxStart = Math.max(0, currentSelection.endTime - minClipDuration);
        // Ensure we don't exceed maxDuration from end
        const minStart = Math.max(0, currentSelection.endTime - maxClipDuration);
        newStart = Math.max(minStart, Math.min(maxStart, seconds));
        newEnd = currentSelection.endTime;
      } else if (dragging === "end") {
        // Ensure end doesn't go before start + minDuration
        const minEnd = Math.min(totalSeconds, currentSelection.startTime + minClipDuration);
        // Ensure we don't exceed maxDuration from start
        const maxEnd = Math.min(totalSeconds, currentSelection.startTime + maxClipDuration);
        newEnd = Math.max(minEnd, Math.min(maxEnd, seconds));
        newStart = currentSelection.startTime;
      }
    }

    // Update ref and local state (minimal re-render, not going through Zustand)
    const newSelection = { startTime: Math.floor(newStart), endTime: Math.floor(newEnd) };
    pendingSelectionRef.current = newSelection;
    setLocalClipSelection(newSelection);
  };

  // Mouse event handlers for clip dragging
  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      hasDraggedRef.current = true;
      handleDrag(e.clientX);
    };

    const handleMouseUp = () => {
      // Commit the final position to Zustand
      if (pendingSelectionRef.current && onClipSelectionChange) {
        onClipSelectionChange(pendingSelectionRef.current.startTime, pendingSelectionRef.current.endTime);
      }

      // Only block the click if we actually moved during the drag
      if (hasDraggedRef.current) {
        justFinishedDraggingRef.current = true;
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
  }, [dragging, dragStartInfo, disabled, clipSelection, onClipSelectionChange, totalSeconds, minClipDuration, maxClipDuration, visibleDuration, viewStart]);

  // Touch event handlers for clip dragging
  useEffect(() => {
    if (!dragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleDrag(e.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      // Commit the final position to Zustand
      if (pendingSelectionRef.current && onClipSelectionChange) {
        onClipSelectionChange(pendingSelectionRef.current.startTime, pendingSelectionRef.current.endTime);
      }

      justFinishedDraggingRef.current = true;
      setDragging(null);
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
  }, [dragging, dragStartInfo, disabled, clipSelection, onClipSelectionChange, totalSeconds, minClipDuration, maxClipDuration, visibleDuration, viewStart]);

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
      const sel = activeClipSelection;
      const centerPoint = sel ? (sel.startTime + sel.endTime) / 2 : currentTime;

      const newVisibleDuration = totalSeconds / newZoom;
      const newOffset = Math.max(0, centerPoint - newVisibleDuration / 2);
      setViewOffset(newZoom === 1 ? 0 : Math.min(newOffset, totalSeconds - newVisibleDuration));
    };

    const element = trackRef.current;
    element.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      element.removeEventListener("wheel", handleWheel);
    };
  }, [zoomLevel, clipSelection, localClipSelection, totalSeconds, currentTime, setZoomLevel, setViewOffset]);

  // Handle click on timeline
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent click from firing if we just finished dragging
    if (disabled || totalSeconds === 0 || dragging || justFinishedDraggingRef.current) {
      return;
    }

    const seekTime = getSecondsFromPosition(e.clientX, trackRef.current, viewStart, visibleDuration);
    seek(Math.max(0, Math.min(totalSeconds, seekTime)));
  };

  // Use local selection during drag, otherwise use prop
  const activeClipSelection = localClipSelection || clipSelection;

  // Calculate progress and clip percentages
  const progressPercent = secondsToPercent(currentTime);
  const clipStartPercent = activeClipSelection ? secondsToPercent(activeClipSelection.startTime) : 0;
  const clipEndPercent = activeClipSelection ? secondsToPercent(activeClipSelection.endTime) : 100;

  // Filter events to only show those in visible range
  const visibleEvents = events.filter((event) => event.offset >= viewStart && event.offset <= viewEnd);

  // Calculate clip center for zoom controls
  const clipCenterPoint = activeClipSelection ? (activeClipSelection.startTime + activeClipSelection.endTime) / 2 : undefined;

  return (
    <div className="w-full space-y-2">
      {/* Zoom controls */}
      <ZoomControls clipCenterPoint={clipCenterPoint} currentTime={currentTime} />

      {/* Timestamp ruler above timeline */}
      <TimelineRuler viewStart={viewStart} viewEnd={viewEnd} visibleDuration={visibleDuration} />

      {/* Timeline bar - always h-8, with context menu */}
      <TimelineContextMenu trackRef={trackRef} viewStart={viewStart} visibleDuration={visibleDuration} disabled={disabled}>
        <div ref={trackRef} className={`relative h-8 w-full rounded-md overflow-hidden bg-muted ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`} onClick={handleTimelineClick}>
          {/* Progress bar */}
          {progressPercent >= 0 && progressPercent <= 100 && (
            <div className="absolute left-0 top-0 h-full bg-purple-600/60 transition-all duration-100" style={{ width: `${Math.max(0, Math.min(progressPercent, 100))}%` }} />
          )}

          {/* Muted segments */}
          <MutedSegments segments={mutedSegments} secondsToPercent={secondsToPercent} />

          {/* Playhead */}
          {progressPercent >= 0 && progressPercent <= 100 && (
            <div
              className="absolute top-1/2 h-6 w-1 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white shadow-md transition-all duration-100"
              style={{ left: `${Math.max(0, Math.min(progressPercent, 100))}%` }}
            />
          )}

          {/* Clip mode overlay */}
          {isClipMode && activeClipSelection && <ClipSelection clipSelection={activeClipSelection} clipStartPercent={clipStartPercent} clipEndPercent={clipEndPercent} disabled={disabled} />}

          {/* Event markers */}
          <EventMarkers events={visibleEvents} secondsToPercent={secondsToPercent} disabled={disabled} />
        </div>
      </TimelineContextMenu>

      {/* Time display */}
      <TimelineDisplay
        isClipMode={isClipMode}
        clipSelection={activeClipSelection}
        viewStart={viewStart}
        viewEnd={viewEnd}
        currentTime={currentTime}
        minClipDuration={minClipDuration}
        maxClipDuration={maxClipDuration}
      />

      {/* Legend */}
      <TimelineLegend mutedSegments={mutedSegments} isClipMode={isClipMode} events={events} />
    </div>
  );
}
