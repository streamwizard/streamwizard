"use client";

import useSWR from "swr";
import type { ObsOutputLatest } from "@repo/metrics";
import { StatCard } from "@/components/shared/stat-card";
import { StatGrid } from "@/components/shared/stat-grid";
import { fetcher, formatTime } from "@/lib/utils";
import { formatKbps } from "@/lib/format";
import { streamQualityTones } from "@/lib/nodes/stream-quality";
import { useRefreshInterval } from "@/providers/refresh-interval-context";

// OIM writes one obs_output point every 10s, so polling faster only re-reads
// the same point.
const MIN_POLL_MS = 10_000;

const pct = (v: number | null, digits = 1) => (v === null ? "–" : `${v.toFixed(digits)}%`);

export function InstanceStreamQualityLive({ instanceId }: { instanceId: string }) {
  const { interval } = useRefreshInterval();
  const { data, isLoading } = useSWR<{ latest: ObsOutputLatest | null }>(
    `/api/metrics/obs-instance/${instanceId}?set=live`,
    fetcher,
    { refreshInterval: Math.max(interval, MIN_POLL_MS) },
  );
  const latest = data?.latest ?? null;
  const tones = streamQualityTones(latest);

  if (!latest) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        {isLoading
          ? "Loading the latest reading…"
          : "No stream stats in the last 2 minutes. OBS is closed, or this node runs an instance manager without stream stats."}
      </p>
    );
  }

  const streaming = latest.streamingActive;
  const status = !streaming ? "Not streaming" : latest.reconnecting ? "Reconnecting" : "Live";
  const notLive = streaming ? undefined : "Only while streaming";

  return (
    <div className="space-y-2">
      <StatGrid cols={6}>
        <StatCard
          title="Stream"
          value={status}
          tone={tones.status}
          description={latest.recordingActive ? "Also recording" : `Updated ${formatTime(latest.time)}`}
        />
        <StatCard
          title="Bitrate"
          value={streaming ? formatKbps(latest.kbps) : "–"}
          tone={tones.bitrate}
          description={streaming && latest.targetKbps ? `Target ${formatKbps(latest.targetKbps)}` : notLive}
        />
        <StatCard
          title="Congestion"
          value={streaming ? pct(latest.congestion === null ? null : latest.congestion * 100, 0) : "–"}
          tone={tones.congestion}
          description={notLive}
          hint="OBS's own estimate of how backed up the network output is. Sustained congestion leads to dropped frames."
        />
        <StatCard
          title="Dropped (network)"
          value={streaming ? pct(latest.dropPct) : "–"}
          tone={tones.dropped}
          description={notLive ?? "Since the stream started"}
          hint="Frames OBS dropped because the connection to Twitch couldn't keep up."
        />
        <StatCard
          title="Skipped (encoder)"
          value={streaming ? pct(latest.encodeLagPct) : "–"}
          tone={tones.encoder}
          description={notLive ?? "Since the stream started"}
          hint="Frames the encoder skipped because it couldn't keep up. Points at the GPU, not the network."
        />
        <StatCard
          title="Render"
          value={latest.renderFps === null ? "–" : `${Math.round(latest.renderFps)} fps`}
          tone={tones.render}
          description={`${pct(latest.renderLagPct)} lagged${latest.targetFps ? ` · target ${Math.round(latest.targetFps)}` : ""}`}
          hint="Frames OBS rendered and the share it rendered too late. Points at scene load, not the stream."
        />
      </StatGrid>
    </div>
  );
}
