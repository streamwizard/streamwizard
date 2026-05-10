"use client";

import { GripVertical } from "lucide-react";
import { useVideoPlayerStore } from "@/stores/video-dialog-store";
import type { ClipSelection as ClipSelectionType } from "./types";

interface ClipSelectionProps {
  clipSelection: ClipSelectionType;
  clipStartPercent: number;
  clipEndPercent: number;
  disabled?: boolean;
}

/**
 * Clip selection overlay with draggable handles
 */
export function ClipSelection({ clipSelection, clipStartPercent, clipEndPercent, disabled }: ClipSelectionProps) {
  const dragging = useVideoPlayerStore((s) => s.dragging);
  const setDragging = useVideoPlayerStore((s) => s.setDragging);
  const setDragStartInfo = useVideoPlayerStore((s) => s.setDragStartInfo);

  const handleMiddleMouseDown = (e: React.MouseEvent) => {
    if (!disabled) {
      e.preventDefault();
      e.stopPropagation();
      setDragging("middle");
      setDragStartInfo({
        clientX: e.clientX,
        startTime: clipSelection.startTime,
        endTime: clipSelection.endTime,
      });
    }
  };

  const handleMiddleTouchStart = (e: React.TouchEvent) => {
    if (!disabled && e.touches.length > 0) {
      e.preventDefault();
      setDragging("middle");
      setDragStartInfo({
        clientX: e.touches[0].clientX,
        startTime: clipSelection.startTime,
        endTime: clipSelection.endTime,
      });
    }
  };

  const handleStartMouseDown = (e: React.MouseEvent) => {
    if (!disabled) {
      e.preventDefault();
      e.stopPropagation();
      setDragging("start");
    }
  };

  const handleStartTouchStart = (e: React.TouchEvent) => {
    if (!disabled) {
      e.preventDefault();
      setDragging("start");
    }
  };

  const handleEndMouseDown = (e: React.MouseEvent) => {
    if (!disabled) {
      e.preventDefault();
      e.stopPropagation();
      setDragging("end");
    }
  };

  const handleEndTouchStart = (e: React.TouchEvent) => {
    if (!disabled) {
      e.preventDefault();
      setDragging("end");
    }
  };

  return (
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
          onMouseDown={handleMiddleMouseDown}
          onTouchStart={handleMiddleTouchStart}
        />
      )}

      {/* Start handle */}
      {clipStartPercent >= 0 && clipStartPercent <= 100 && (
        <div
          className={`absolute top-0 bottom-0 w-4 flex items-center justify-center bg-white rounded-sm shadow-lg z-10 ${
            disabled ? "" : "cursor-ew-resize hover:bg-gray-100"
          } ${dragging === "start" ? "bg-gray-200" : ""}`}
          style={{ left: `calc(${clipStartPercent}% - 8px)` }}
          onMouseDown={handleStartMouseDown}
          onTouchStart={handleStartTouchStart}
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
          onMouseDown={handleEndMouseDown}
          onTouchStart={handleEndTouchStart}
        >
          <GripVertical className="h-4 w-4 text-purple-600" />
        </div>
      )}
    </>
  );
}
