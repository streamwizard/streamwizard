import { queryObsOutputDelta, queryObsOutputField, type ObsOutputPoint } from "@repo/metrics";
import type { NodeMetricPoint } from "@/components/shared/charts/node-metric-chart";
import { settled } from "@/lib/settled";

// The "Stream quality" chart payload for one OBS instance, shared by the page
// (first render) and /api/metrics/obs-instance/[id]?set=output (refreshes).
// Several Influx series go into one chart, so each is relabeled to the line
// name the chart's legend shows.

export interface StreamQualitySeries {
  outputBitrate: NodeMetricPoint[];
  outputCongestion: NodeMetricPoint[];
  outputFramesLost: NodeMetricPoint[];
  outputReconnects: NodeMetricPoint[];
  outputRenderFps: NodeMetricPoint[];
}

function label(points: ObsOutputPoint[], name: string, scale = 1): NodeMetricPoint[] {
  return points.map((p) => ({ time: p.time, nodeId: name, value: p.value * scale }));
}

export async function getStreamQualitySeries(
  instanceId: string,
  fluxRange: string,
  window: string,
): Promise<StreamQualitySeries> {
  const [kbps, kbpsMin, congestion, congestionMax, dropped, skipped, lagged, reconnects, fps, targetFps] =
    await Promise.allSettled([
      queryObsOutputField(instanceId, "kbps", "mean", fluxRange, window),
      queryObsOutputField(instanceId, "kbps_min", "min", fluxRange, window),
      queryObsOutputField(instanceId, "congestion", "mean", fluxRange, window),
      queryObsOutputField(instanceId, "congestion_max", "max", fluxRange, window),
      queryObsOutputDelta(instanceId, "dropped_frames", fluxRange, window),
      queryObsOutputDelta(instanceId, "encode_skipped_frames", fluxRange, window),
      queryObsOutputDelta(instanceId, "render_lagged_frames", fluxRange, window),
      queryObsOutputField(instanceId, "reconnects", "sum", fluxRange, window),
      queryObsOutputField(instanceId, "render_active_fps", "mean", fluxRange, window),
      queryObsOutputField(instanceId, "render_target_fps", "mean", fluxRange, window),
    ]);
  const s = (r: PromiseSettledResult<ObsOutputPoint[]>, name: string) => settled(r, [], `obs output ${name}`);

  return {
    outputBitrate: [...label(s(kbps, "kbps"), "Average"), ...label(s(kbpsMin, "kbps min"), "Lowest")],
    // Congestion is 0..1; the chart shows percent.
    outputCongestion: [
      ...label(s(congestion, "congestion"), "Average", 100),
      ...label(s(congestionMax, "congestion max"), "Peak", 100),
    ],
    outputFramesLost: [
      ...label(s(dropped, "dropped frames"), "Network"),
      ...label(s(skipped, "encoder skipped"), "Encoder"),
      ...label(s(lagged, "render lagged"), "Render"),
    ],
    outputReconnects: label(s(reconnects, "reconnects"), "Reconnects"),
    outputRenderFps: [...label(s(fps, "render fps"), "Rendered"), ...label(s(targetFps, "target fps"), "Target")],
  };
}
