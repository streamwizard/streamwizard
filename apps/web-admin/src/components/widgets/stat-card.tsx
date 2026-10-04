import { Info, type LucideIcon } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Popover, PopoverContent, PopoverTrigger } from "@repo/ui";
import { cn } from "@/lib/utils";

type StatTone = "default" | "positive" | "warning" | "danger";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: "up" | "down" | "neutral";
  /** Colors the value to signal health at a glance. */
  tone?: StatTone;
  /** Optional leading glyph shown top-right, muted. */
  icon?: LucideIcon;
  /** Short explanation behind the info button next to the title. */
  hint?: string;
  className?: string;
}

const TONE_VALUE_CLASS: Record<StatTone, string> = {
  default: "",
  positive: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
};

export function StatCard({ title, value, description, trend, tone = "default", icon: Icon, hint, className }: StatCardProps) {
  return (
    <Card className={cn("gap-3 py-4 transition-colors hover:border-foreground/20 md:gap-6 md:py-6", className)}>
      <CardHeader className="px-4 pb-0 md:px-6 md:pb-2">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <CardTitle className="flex min-w-0 items-center gap-1 text-sm leading-tight font-medium text-muted-foreground">
            <span className="min-w-0">{title}</span>
            {hint && (
              // A popover, not a title attribute: it has to open on a tap too.
              <Popover>
                <PopoverTrigger
                  aria-label={`About ${title}`}
                  className="-m-2 shrink-0 rounded-full p-2 text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <Info className="h-3.5 w-3.5" aria-hidden="true" />
                </PopoverTrigger>
                <PopoverContent className="w-64 text-sm">{hint}</PopoverContent>
              </Popover>
            )}
          </CardTitle>
          {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />}
        </div>
      </CardHeader>
      <CardContent className="px-4 md:px-6">
        <div className="flex items-end gap-2">
          <span className={cn("text-2xl font-bold tabular-nums md:text-3xl", TONE_VALUE_CLASS[tone])}>{value}</span>
          {trend && trend !== "neutral" && (
            <Badge
              variant="secondary"
              className={cn(
                "mb-1 text-xs",
                trend === "up" && "text-green-600 dark:text-green-400",
                trend === "down" && "text-red-600 dark:text-red-400"
              )}
            >
              {trend === "up" ? "↑" : "↓"}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
