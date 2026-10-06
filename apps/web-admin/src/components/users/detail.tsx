import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui";
import { formatDateTime, formatRelativeTime } from "@/lib/discord/tickets";

/** One labelled line in a user card: label left, value right. */
export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      {/* The label keeps its own width (up to 60%) so a long value can't squeeze it into one word per line. */}
      <dt className="max-w-[60%] shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/**
 * A relative time that opens the exact one on a tap or click. A title
 * attribute never shows on a phone, so the dotted underline is the hint.
 */
export function When({ iso, empty = "Never" }: { iso: string | null; empty?: string }) {
  if (!iso) return <span className="text-muted-foreground">{empty}</span>;
  return (
    <Popover>
      {/* Negative margin plus padding: a taller tap area without moving the text. */}
      <PopoverTrigger className="-my-2 cursor-pointer rounded-sm py-2 underline decoration-muted-foreground/50 decoration-dotted underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
        <time dateTime={iso}>{formatRelativeTime(iso)}</time>
      </PopoverTrigger>
      <PopoverContent className="w-auto px-3 py-2 text-sm">{formatDateTime(iso)}</PopoverContent>
    </Popover>
  );
}
