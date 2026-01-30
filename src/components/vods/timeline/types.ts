import type { StreamEventType } from "@/types/stream-events";

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

export interface ClipSelection {
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

export interface VideoTimelineProps {
  /** Total duration of the video in Twitch format (e.g., "1h30m0s") or seconds */
  duration: string | number;
  /** Current playback position in seconds */
  currentTime: number;
  /** List of events to display on the timeline */
  events?: TimelineEvent[];
  /** Muted segments to display on the timeline */
  mutedSegments?: MutedSegment[] | null;
  /** Called when user clicks on the timeline to seek (optional - uses store if not provided) */
  onSeek?: (seconds: number) => void;
  /** Called when user clicks on an event (optional - uses store if not provided) */
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

/** Props passed to child timeline components */
export interface TimelineContextProps {
  totalSeconds: number;
  visibleDuration: number;
  viewStart: number;
  viewEnd: number;
  secondsToPercent: (seconds: number) => number;
  percentToSeconds: (percent: number) => number;
}
