import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SmpStepStatus = "done" | "current" | "locked";

const STATUS_LABEL: Record<SmpStepStatus, string> = { done: "Done", current: "Up next", locked: "Locked" };

/*
 * One row of the sign-up stepper. The status is said in words as well as in
 * colour, and the row that is up next carries aria-current. `children` is the
 * step's action: a button, the form, or nothing for a step that is done or
 * still locked.
 */
export function SmpStep({
  number,
  title,
  description,
  status,
  children,
}: {
  number: number;
  title: string;
  description: string;
  status: SmpStepStatus;
  children?: ReactNode;
}) {
  return (
    <li
      aria-current={status === "current" ? "step" : undefined}
      className={cn("pixel-panel flex gap-4 p-5 sm:p-6", status === "locked" && "opacity-60")}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-10 shrink-0 items-center justify-center border-2 border-(--smp-ink) font-pixel text-lg",
          status === "done" && "bg-(--smp-gold) text-(--smp-ink)",
          status === "current" && "bg-(--smp-purple) text-white",
          status === "locked" && "bg-black/40 text-(--smp-lavender)",
        )}
      >
        {status === "done" ? "✓" : number}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="pixel-shadow font-pixel text-xl font-medium text-white">{title}</h3>
          <span
            className={cn("font-pixel text-sm", status === "done" ? "text-(--smp-gold)" : "text-(--smp-lavender)")}
          >
            {STATUS_LABEL[status]}
          </span>
        </div>
        <p className="mt-1 text-sm text-foreground/80">{description}</p>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </li>
  );
}
