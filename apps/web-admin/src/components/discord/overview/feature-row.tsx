import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { StatusIndicator } from "@/components/shared/status-indicator";

/** One line of the feature list: what it is, how it is set up, and whether it is on. */
export function FeatureRow({
  href,
  title,
  icon: Icon,
  enabled,
  statusLabel,
  lines,
}: {
  href: string;
  title: string;
  icon: LucideIcon;
  enabled: boolean;
  statusLabel?: string;
  lines: string[];
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="truncate text-sm text-muted-foreground">{lines.join(" · ")}</p>
        </div>
        <StatusIndicator
          status={enabled ? "ok" : "muted"}
          label={statusLabel ?? (enabled ? "On" : "Off")}
          className="shrink-0 text-xs"
        />
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
