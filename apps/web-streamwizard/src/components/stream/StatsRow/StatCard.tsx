import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card } from "@repo/ui";
import type { LucideIcon } from "lucide-react";

interface Trend {
  direction: "up" | "down" | "neutral";
  label: string;
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: Trend;
}

export function StatCard({ icon: Icon, label, value, trend }: StatCardProps) {
  return (
    <Card className="relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:border-white/[0.12]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </div>
      <p className="font-mono text-xl font-bold tabular-nums tracking-tight sm:text-2xl">{value}</p>
      {trend && (
        <div
          className={
            "flex items-center gap-1 text-xs " +
            (trend.direction === "up"
              ? "text-green-500"
              : trend.direction === "down"
              ? "text-red-500"
              : "text-muted-foreground")
          }
        >
          {trend.direction === "up" ? (
            <TrendingUp className="h-3 w-3" />
          ) : trend.direction === "down" ? (
            <TrendingDown className="h-3 w-3" />
          ) : (
            <Minus className="h-3 w-3" />
          )}
          {trend.label}
        </div>
      )}
    </Card>
  );
}
