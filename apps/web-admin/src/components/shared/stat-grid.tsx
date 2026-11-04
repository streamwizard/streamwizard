import { cn } from "@/lib/utils";

// Two per row on phones, never more: a stat card needs about 150px to stay readable.
const COLUMNS = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
} as const;

/** The row of stat cards at the top of a page. `cols` is the count on a wide screen. */
export function StatGrid({ cols, className, children }: { cols: keyof typeof COLUMNS; className?: string; children: React.ReactNode }) {
  return <div className={cn("grid gap-3 md:gap-4", COLUMNS[cols], className)}>{children}</div>;
}

/** Charts side by side on a wide screen, one per row below it. */
export function ChartGrid({ cols = 2, className, children }: { cols?: 2 | 3; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4", cols === 3 ? "lg:grid-cols-2 xl:grid-cols-3" : "lg:grid-cols-2", className)}>{children}</div>
  );
}
