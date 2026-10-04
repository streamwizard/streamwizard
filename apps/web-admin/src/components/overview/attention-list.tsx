import Link from "next/link";
import { CheckCircle2, ChevronRight, CircleAlert, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { Card } from "@repo/ui";
import type { AttentionItem, AttentionTone } from "@/lib/overview";
import { cn } from "@/lib/utils";

const TONE: Record<AttentionTone, { icon: LucideIcon; className: string; label: string }> = {
  crit: { icon: CircleAlert, className: "text-red-600 dark:text-red-400", label: "Critical" },
  warn: { icon: TriangleAlert, className: "text-amber-600 dark:text-amber-400", label: "Warning" },
  info: { icon: Info, className: "text-muted-foreground", label: "To do" },
};

/** Everything that is waiting on a person, worst first. Each row goes to where it gets fixed. */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <Card className="flex-row items-center gap-3 px-4 py-4 md:px-6">
        <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <div>
          <p className="text-sm font-medium">All clear</p>
          <p className="text-sm text-muted-foreground">No alerts firing, nobody waiting on a reply, nothing to review.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="gap-0 py-0">
      <ul className="divide-y">
        {items.map((item) => {
          const tone = TONE[item.tone];
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none md:px-6"
              >
                <tone.icon className={cn("size-5 shrink-0", tone.className)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    <span className="sr-only">{tone.label}: </span>
                    {item.title}
                  </p>
                  {item.detail && <p className="text-sm break-words text-muted-foreground">{item.detail}</p>}
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
