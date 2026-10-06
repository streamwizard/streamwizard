import Link from "next/link";
import type { Health, SubsystemStatus } from "@/lib/overview";
import { cn } from "@/lib/utils";

const DOT: Record<Health, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  crit: "bg-red-500",
  silenced: "bg-muted-foreground/40",
  none: "bg-muted-foreground/40",
};

const DETAIL: Record<Health, string> = {
  ok: "text-muted-foreground",
  warn: "text-amber-600 dark:text-amber-400",
  crit: "text-red-600 dark:text-red-400",
  silenced: "text-muted-foreground",
  none: "text-muted-foreground",
};

/**
 * One chip per subsystem. The colour comes with words ("OK", "2 firing", "No
 * checks"), so it never carries the meaning alone.
 */
export function StatusStrip({ subsystems }: { subsystems: SubsystemStatus[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 md:gap-3">
      {subsystems.map((subsystem) => (
        <li key={subsystem.key}>
          <Link
            href={subsystem.href}
            className={cn(
              "flex min-h-14 flex-col justify-center gap-0.5 rounded-lg border bg-card px-3 py-2 transition-colors hover:border-foreground/20 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              subsystem.health === "crit" && "border-red-500/50",
              subsystem.health === "warn" && "border-amber-500/50",
            )}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[subsystem.health])} />
              <span className="truncate">{subsystem.label}</span>
            </span>
            <span className={cn("pl-4 text-xs tabular-nums", DETAIL[subsystem.health])}>{subsystem.detail}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
