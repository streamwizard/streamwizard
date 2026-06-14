"use client";

import { useEffect, useRef, useState } from "react";
import { formatDuration } from "@/types/twitch-video";
import { calculateTimestamps } from "./timeline-utils";

interface TimelineRulerProps {
  viewStart: number;
  viewEnd: number;
  visibleDuration: number;
}

// ~55px per label (text width + minimum gap between labels)
const LABEL_WIDTH_PX = 55;

/**
 * Timestamp ruler displayed above the timeline.
 * Measures its own width so it never renders more labels than fit,
 * preventing overlap at any zoom level or screen size.
 */
export function TimelineRuler({ viewStart, viewEnd, visibleDuration }: TimelineRulerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxLabels, setMaxLabels] = useState(16);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setMaxLabels(Math.max(3, Math.floor(width / LABEL_WIDTH_PX)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const timestamps = calculateTimestamps(viewStart, viewEnd, visibleDuration, maxLabels);

  return (
    <div ref={containerRef} className="relative w-full h-5 mb-1">
      {timestamps.map(({ time, percent }) => (
        <div key={time} className="absolute top-0 flex flex-col items-center" style={{ left: `${percent}%`, transform: "translateX(-50%)" }}>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDuration(Math.floor(time))}</span>
          <div className="w-px h-1 bg-muted-foreground/40" />
        </div>
      ))}
    </div>
  );
}
