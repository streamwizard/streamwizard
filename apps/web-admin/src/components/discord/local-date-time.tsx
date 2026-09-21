"use client";

import { formatDateTime } from "@/lib/discord/tickets";

/**
 * A time in the admin's own zone. The server renders it in its zone (UTC in
 * production), so the text may shift on hydration; that is the point.
 */
export function LocalDateTime({ iso, className }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {formatDateTime(iso)}
    </time>
  );
}
