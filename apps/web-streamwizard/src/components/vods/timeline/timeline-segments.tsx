"use client";

import { formatDuration } from "@/types/twitch video";
import { useVideoPlayerStore } from "@/stores/video-dialog-store";
import type { TimelineSegmentType } from "./types";

/** Visual configuration for each segment type */
const SEGMENT_STYLES: Record<TimelineSegmentType, { bg: string; border: string; stripeColor: string; label: string }> = {
  muted: {
    bg: "bg-red-500/40",
    border: "border-red-600/60",
    stripeColor: "rgba(239, 68, 68, 0.2)",
    label: "Muted",
  },
  ad_break: {
    bg: "bg-amber-500/40",
    border: "border-amber-600/60",
    stripeColor: "rgba(245, 158, 11, 0.2)",
    label: "Ad Break",
  },
};

interface TimelineSegmentsProps {
  secondsToPercent: (seconds: number) => number;
}

/**
 * Renders all segment types (muted, ad breaks, etc.) on the timeline.
 * Reads segments from the store and applies per-type styling.
 */
export function TimelineSegments({ secondsToPercent }: TimelineSegmentsProps) {
  const segments = useVideoPlayerStore((state) => state.segments);

  return (
    <>
      {Array.from(segments.entries()).map(([type, typeSegments]) => {
        const style = SEGMENT_STYLES[type];
        if (!style || typeSegments.length === 0) return null;

        return typeSegments.map((segment, index) => {
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
              key={`${type}-${index}`}
              className={`absolute top-0 bottom-0 ${style.bg} border-l border-r ${style.border}`}
              style={{
                left: `${clampedStart}%`,
                width: `${width}%`,
                backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 4px, ${style.stripeColor} 4px, ${style.stripeColor} 8px)`,
              }}
              title={`${style.label}: ${formatDuration(segment.offset)} - ${formatDuration(segmentEnd)}`}
            />
          );
        });
      })}
    </>
  );
}

/** Export the style config for use in the legend */
export { SEGMENT_STYLES };
