"use client";

import { formatDuration } from "@/types/twitch video";
import { calculateTimestamps } from "./timeline-utils";

interface TimelineRulerProps {
  viewStart: number;
  viewEnd: number;
  visibleDuration: number;
}

/**
 * Timestamp ruler displayed above the timeline
 */
export function TimelineRuler({ viewStart, viewEnd, visibleDuration }: TimelineRulerProps) {
  const timestamps = calculateTimestamps(viewStart, viewEnd, visibleDuration);

  return (
    <div className="relative w-full h-5 mb-1">
      {timestamps.map(({ time, percent }) => (
        <div key={time} className="absolute top-0 flex flex-col items-center" style={{ left: `${percent}%`, transform: "translateX(-50%)" }}>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDuration(Math.floor(time))}</span>
          <div className="w-px h-1 bg-muted-foreground/40" />
        </div>
      ))}
    </div>
  );
}
