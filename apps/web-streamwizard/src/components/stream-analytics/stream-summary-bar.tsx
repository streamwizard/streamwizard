import { BarChart2, Clock, Eye, Film, Play, Star, Users, Zap } from "lucide-react";
import { Card } from "@repo/ui";
import type { StreamSummary } from "@/actions/supabase/analytics/stream-analytics";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

interface StreamSummaryBarProps {
  summary: StreamSummary;
}

export function StreamSummaryBar({ summary }: StreamSummaryBarProps) {
  return (
    <>
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      <Card className="col-span-2 flex flex-col justify-between gap-2 p-4 sm:col-span-3 lg:col-span-2">
        <div>
          <p className="text-xs text-muted-foreground">Stream title</p>
          <p className="mt-0.5 font-semibold leading-snug line-clamp-2">
            {summary.title ?? "Untitled stream"}
          </p>
        </div>
        <div className="space-y-0.5">
          {summary.category && (
            <p className="text-xs text-muted-foreground">{summary.category}</p>
          )}
          {summary.startedAt && (
            <p className="text-xs text-muted-foreground">{formatDate(summary.startedAt)}</p>
          )}
        </div>
      </Card>

      <StatCard
        label="Duration"
        value={summary.durationSeconds != null ? formatDuration(summary.durationSeconds) : "—"}
        icon={Clock}
      />
      <StatCard
        label="Peak viewers"
        value={summary.peakViewers.toLocaleString()}
        icon={Eye}
      />
      <StatCard
        label="Total subs"
        value={summary.totalSubs.toLocaleString()}
        icon={Star}
      />
      <StatCard
        label="Total follows"
        value={summary.totalFollows.toLocaleString()}
        icon={Users}
      />
      <StatCard
        label="Channel points"
        value={formatNumber(summary.totalChannelPoints)}
        icon={Zap}
        sub="spent this stream"
      />
    </section>

    <section className="grid grid-cols-3 gap-3">
      <StatCard
        label="Avg viewers"
        value={summary.averageViewers.toLocaleString()}
        icon={BarChart2}
      />
      <StatCard
        label="Clips created"
        value={summary.totalClips.toLocaleString()}
        icon={Film}
      />
      <StatCard
        label="Clip views"
        value={formatNumber(summary.totalClipViews)}
        icon={Play}
      />
    </section>
    </>
  );
}
