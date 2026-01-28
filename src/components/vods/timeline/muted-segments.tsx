"use client";

import { formatDuration } from "@/types/twitch video";
import type { MutedSegment } from "./types";

interface MutedSegmentsProps {
  segments: MutedSegment[] | null | undefined;
  secondsToPercent: (seconds: number) => number;
}

/**
 * Renders muted segment indicators on the timeline
 */
export function MutedSegments({ segments, secondsToPercent }: MutedSegmentsProps) {
  if (!segments || segments.length === 0) return null;

  return (
    <>
      {segments.map((segment, index) => {
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
    </>
  );
}
