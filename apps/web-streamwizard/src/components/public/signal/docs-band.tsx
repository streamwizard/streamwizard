import Link from "next/link";
import { BookOpen, ArrowRight } from "lucide-react";

/*
 * The standing pointer to docs.streamwizard.org. Every cluster page ends its
 * story with the specific docs section that continues it.
 */
export function DocsBand({ href, label, copy }: { href: string; label: string; copy: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 px-6 py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-[#9e7aff]" aria-hidden="true" />
          <p className="max-w-xl text-sm text-muted-foreground">{copy}</p>
        </div>
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          {label}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
