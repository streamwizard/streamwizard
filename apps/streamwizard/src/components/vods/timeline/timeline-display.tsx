"use client";

import { formatDuration } from "@/types/twitch video";
import type { ClipSelection } from "./types";

interface TimelineDisplayProps {
  isClipMode: boolean;
  clipSelection?: ClipSelection;
  viewStart: number;
  viewEnd: number;
  currentTime: number;
  minClipDuration: number;
  maxClipDuration: number;
}

/**
 * Time display shown below the timeline track
 */
export function TimelineDisplay({ isClipMode, clipSelection, viewStart, viewEnd, currentTime, minClipDuration, maxClipDuration }: TimelineDisplayProps) {
  const clipDuration = clipSelection ? clipSelection.endTime - clipSelection.startTime : 0;

  return (
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
  );
}
