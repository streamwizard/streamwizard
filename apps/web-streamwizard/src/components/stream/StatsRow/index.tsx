import { Clock, Eye, Star, UserPlus, Users } from "lucide-react";
import { getStatsRowData } from "@/actions/supabase/analytics/stream-stats";
import { StatCard } from "./StatCard";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function numTrend(current: number, previous: number | null) {
  if (previous === null) return undefined;
  const diff = current - previous;
  if (diff > 0) return { direction: "up" as const, label: `+${diff} from last stream` };
  if (diff < 0) return { direction: "down" as const, label: `${diff} from last stream` };
  return { direction: "neutral" as const, label: "Same as last" };
}

function durTrend(current: number | null, previous: number | null) {
  if (current === null || previous === null) return undefined;
  const diff = current - previous;
  if (diff > 0) return { direction: "up" as const, label: `+${formatDuration(diff)} longer` };
  if (diff < 0) return { direction: "down" as const, label: `${formatDuration(-diff)} shorter` };
  return { direction: "neutral" as const, label: "Same duration" };
}

interface StatsRowProps {
  streamId: string;
  broadcasterId: string;
  startedAt: string | null;
  endedAt: string | null;
}

export async function StatsRow({ streamId, broadcasterId, startedAt, endedAt }: StatsRowProps) {
  const { current, previous } = await getStatsRowData(streamId, broadcasterId, startedAt, endedAt);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard
        icon={Eye}
        label="Peak viewers"
        value={current.peakViewers.toLocaleString()}
        trend={numTrend(current.peakViewers, previous?.peakViewers ?? null)}
      />
      <StatCard
        icon={Users}
        label="Avg viewers"
        value={current.avgViewers.toLocaleString()}
        trend={numTrend(current.avgViewers, previous?.avgViewers ?? null)}
      />
      <StatCard
        icon={Clock}
        label="Duration"
        value={current.durationSeconds != null ? formatDuration(current.durationSeconds) : "—"}
        trend={durTrend(current.durationSeconds, previous?.durationSeconds ?? null)}
      />
      <StatCard
        icon={UserPlus}
        label="New follows"
        value={current.follows.toLocaleString()}
        trend={numTrend(current.follows, previous?.follows ?? null)}
      />
      <StatCard
        icon={Star}
        label="New subs"
        value={current.subs.toLocaleString()}
        trend={numTrend(current.subs, previous?.subs ?? null)}
      />
    </div>
  );
}
