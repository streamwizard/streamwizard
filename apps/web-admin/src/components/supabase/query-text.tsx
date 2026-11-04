import { ChevronRight } from "lucide-react";

/** The query on one or two lines, the whole statement behind a tap: a title attribute never opens on a phone. */
export function QueryText({ query }: { query: string }) {
  return (
    <details className="group min-w-0 font-normal">
      <summary className="flex min-h-11 cursor-pointer list-none items-start gap-1.5 rounded-sm py-1 sm:min-h-0 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
        <code className="line-clamp-2 font-mono text-xs break-all whitespace-normal group-open:hidden">{query.replace(/\s+/g, " ")}</code>
        <span className="hidden text-xs text-muted-foreground group-open:inline">Full query</span>
      </summary>
      <pre className="mt-1 max-h-80 overflow-y-auto rounded-md bg-muted p-3 font-mono text-xs break-words whitespace-pre-wrap">{query}</pre>
    </details>
  );
}
