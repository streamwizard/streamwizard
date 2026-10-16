import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button, Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@repo/ui";

/** Filters that match nothing. A plain link, so it works before the page hydrates. */
export function ContentEmptyState({ noun, clearHref }: { noun: string; clearHref: string }) {
  return (
    <Empty className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.01]">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-white/[0.06] text-muted-foreground">
          <SearchX aria-hidden />
        </EmptyMedia>
        <EmptyTitle>No {noun} match that</EmptyTitle>
        <EmptyDescription>Try fewer filters or a shorter search.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline" className="border-purple-400/30 bg-purple-400/[0.06] text-purple-200 hover:bg-purple-400/[0.12]">
          <Link href={clearHref} scroll={false}>
            Clear filters
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
