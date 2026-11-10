import type { ObsOutputLatest } from "@repo/metrics";

// How healthy one OBS instance's stream output looks right now, for the live
// tiles on the instance "Stream quality" tab. Pure, so it can run client-side
// and be tested without Influx.

export type QualityTone = "default" | "positive" | "warning" | "danger";

/** [warning, danger] thresholds; a value at or above a threshold takes that tone. */
const THRESHOLDS = {
  // Percent of frames since the stream started. OBS itself turns its status
  // bar yellow around 1% and viewers notice stutter from a few percent.
  dropPct: [1, 5],
  encodeLagPct: [1, 5],
  renderLagPct: [1, 5],
  // OBS's congestion estimate, 0..1.
  congestion: [0.1, 0.3],
} as const satisfies Record<string, readonly [number, number]>;

function byThreshold(value: number | null, [warning, danger]: readonly [number, number]): QualityTone {
  if (value === null) return "default";
  if (value >= danger) return "danger";
  if (value >= warning) return "warning";
  return "positive";
}

/** Bitrate against the encoder's target: under 80% is a warning, under 50% danger. */
function bitrateTone(kbps: number | null, targetKbps: number | null): QualityTone {
  if (kbps === null || !targetKbps) return "default";
  const ratio = kbps / targetKbps;
  if (ratio < 0.5) return "danger";
  if (ratio < 0.8) return "warning";
  return "positive";
}

/** Rendered FPS against the target: more than 10% short is a warning, 25% danger. */
function fpsTone(fps: number | null, targetFps: number | null): QualityTone {
  if (fps === null || !targetFps) return "default";
  const ratio = fps / targetFps;
  if (ratio < 0.75) return "danger";
  if (ratio < 0.9) return "warning";
  return "positive";
}

const RANK: Record<QualityTone, number> = { default: 0, positive: 1, warning: 2, danger: 3 };
const worst = (...tones: QualityTone[]): QualityTone => tones.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "default");

export interface StreamQualityTones {
  status: QualityTone;
  bitrate: QualityTone;
  congestion: QualityTone;
  dropped: QualityTone;
  encoder: QualityTone;
  /** Render lag and rendered FPS against the target, whichever is worse. */
  render: QualityTone;
}

const NEUTRAL: StreamQualityTones = {
  status: "default",
  bitrate: "default",
  congestion: "default",
  dropped: "default",
  encoder: "default",
  render: "default",
};

/**
 * Tone per live tile. The stream-only tiles stay neutral while nothing is
 * streaming (OBS stops sending those fields); render stats apply either way.
 */
export function streamQualityTones(latest: ObsOutputLatest | null): StreamQualityTones {
  if (!latest) return NEUTRAL;
  const render = worst(
    byThreshold(latest.renderLagPct, THRESHOLDS.renderLagPct),
    fpsTone(latest.renderFps, latest.targetFps),
  );
  if (!latest.streamingActive) return { ...NEUTRAL, render };

  const tones = {
    bitrate: bitrateTone(latest.kbps, latest.targetKbps),
    congestion: byThreshold(latest.congestion, THRESHOLDS.congestion),
    dropped: byThreshold(latest.dropPct, THRESHOLDS.dropPct),
    encoder: byThreshold(latest.encodeLagPct, THRESHOLDS.encodeLagPct),
    render,
  };
  const overall = worst(...Object.values(tones));
  const status: QualityTone = latest.reconnecting ? "danger" : overall === "default" ? "positive" : overall;
  return { status, ...tones };
}
