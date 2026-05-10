"use client";

import { StreamEventType } from "@/types/stream-events";
import { getEventTypeInfo } from "@/lib/utils/stream-events";
import { useVideoPlayerStore } from "@/stores/video-dialog-store";
import { SEGMENT_STYLES } from "./timeline-segments";
import type { TimelineEvent } from "./types";

interface TimelineLegendProps {
  isClipMode: boolean;
  events: TimelineEvent[];
}

/**
 * Legend section showing what each timeline element represents
 */

export function TimelineLegend({ isClipMode, events }: TimelineLegendProps) {
  const segments = useVideoPlayerStore((state) => state.segments);

  return (
    <div className="flex flex-wrap gap-3 text-xs border-t mt-2 pt-3">
      {/* Progress & Playhead */}
      <div className="flex items-center gap-1">
        <div className="h-3 w-4 bg-purple-600/60 rounded-sm" />
        <span className="text-muted-foreground">Progress</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="h-3 w-1 bg-white rounded-sm shadow" />
        <span className="text-muted-foreground">Playhead</span>
      </div>

      {/* Segment types (muted, ad breaks, etc.) */}
      {Array.from(segments.entries()).map(([type, typeSegments]) => {
        const style = SEGMENT_STYLES[type];
        if (!style || typeSegments.length === 0) return null;
        return (
          <div key={type} className="flex items-center gap-1">
            <div
              className={`h-3 w-4 ${style.bg} border ${style.border} rounded-sm`}
              style={{
                backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 2px, ${style.stripeColor} 2px, ${style.stripeColor} 4px)`,
              }}
            />
            <span className="text-muted-foreground">
              {style.label} ({typeSegments.length})
            </span>
          </div>
        );
      })}

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
  );
}
