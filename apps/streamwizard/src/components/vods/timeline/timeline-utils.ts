/**
 * Convert seconds to percentage within visible range
 */
export function secondsToPercent(seconds: number, viewStart: number, visibleDuration: number): number {
  if (visibleDuration === 0) return 0;
  return ((seconds - viewStart) / visibleDuration) * 100;
}

/**
 * Convert percentage to seconds within visible range
 */
export function percentToSeconds(percent: number, viewStart: number, visibleDuration: number): number {
  return viewStart + (percent / 100) * visibleDuration;
}

/**
 * Get seconds from mouse/touch position on track element
 */
export function getSecondsFromPosition(clientX: number, trackElement: HTMLElement | null, viewStart: number, visibleDuration: number): number {
  if (!trackElement) return 0;
  const rect = trackElement.getBoundingClientRect();
  const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  return Math.floor(percentToSeconds(percent, viewStart, visibleDuration));
}

/**
 * Calculate nice timestamp intervals and positions for the ruler
 */
export function calculateTimestamps(viewStart: number, viewEnd: number, visibleDuration: number): { time: number; percent: number }[] {
  // Calculate appropriate interval based on visible duration
  // We want approximately 16 timestamps visible at any time
  const targetTimestampCount = 16;
  const rawInterval = visibleDuration / targetTimestampCount;

  // Round to nice intervals: 1s, 5s, 10s, 15s, 30s, 1m, 2m, 5m, 10m, 15m, 30m, 1h, etc.
  const niceIntervals = [1, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400];
  const interval = niceIntervals.find((i) => i >= rawInterval) || niceIntervals[niceIntervals.length - 1];

  // Generate timestamps
  const timestamps: { time: number; percent: number }[] = [];
  const firstTimestamp = Math.ceil(viewStart / interval) * interval;

  for (let time = firstTimestamp; time <= viewEnd; time += interval) {
    const percent = secondsToPercent(time, viewStart, visibleDuration);
    if (percent >= 0 && percent <= 100) {
      timestamps.push({ time, percent });
    }
  }

  return timestamps;
}
