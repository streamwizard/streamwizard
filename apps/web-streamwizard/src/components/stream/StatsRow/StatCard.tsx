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
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
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
