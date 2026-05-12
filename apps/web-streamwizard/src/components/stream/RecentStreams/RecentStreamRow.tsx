import { TrendingDown, TrendingUp } from "lucide-react";
import type { RecentStream } from "@/actions/supabase/analytics/recent-streams";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface RecentStreamRowProps {
  stream: RecentStream;
  maxPeak: number;
  prevPeak: number | null;
}

export function RecentStreamRow({ stream, maxPeak, prevPeak }: RecentStreamRowProps) {
  const barWidth = maxPeak > 0 ? Math.round((stream.peakViewers / maxPeak) * 100) : 0;
  const isUp = prevPeak !== null && stream.peakViewers > prevPeak;
  const isDown = prevPeak !== null && stream.peakViewers < prevPeak;

  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium leading-snug">
            {stream.title ?? "Untitled stream"}
          </p>
          {stream.categoryName && (
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {stream.categoryName}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {stream.startedAt ? formatDate(stream.startedAt) : "Unknown date"}
          {stream.durationSeconds != null && ` · ${formatDuration(stream.durationSeconds)}`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="w-16">
          <div className="mb-0.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{stream.peakViewers.toLocaleString()}</span>
            {isUp && <TrendingUp className="h-3 w-3 text-green-500" />}
            {isDown && <TrendingDown className="h-3 w-3 text-red-500" />}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
