import Link from "next/link";
import { Archive, CheckCheck, Inbox, MoonStar, SearchX, Ticket } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/components/ui/empty";

/** The ticket list views; the tickets page defines what each one filters on. */
export type TicketView = "open" | "needs_reply" | "stale" | "closed" | "all";

const EMPTY: Record<TicketView, { icon: LucideIcon; title: string; description: string }> = {
  open: { icon: Inbox, title: "Nothing open", description: "Every ticket is closed. Enjoy the quiet while it lasts." },
  needs_reply: { icon: CheckCheck, title: "Everyone has a reply", description: "No opener is waiting on staff right now." },
  stale: { icon: MoonStar, title: "Nothing has gone quiet", description: "Every open ticket has had a message inside the reminder window." },
  closed: { icon: Archive, title: "No closed tickets yet", description: "Closed tickets and their transcripts land here." },
  all: { icon: Ticket, title: "No tickets yet", description: "Quiet in support, for now." },
};

export function TicketEmptyList({ view, filtered, clearHref }: { view: TicketView; filtered: boolean; clearHref: string }) {
  const state = filtered
    ? { icon: SearchX, title: "No tickets match", description: "Loosen a filter or clear them all." }
    : EMPTY[view];
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <state.icon />
        </EmptyMedia>
        <EmptyTitle>{state.title}</EmptyTitle>
        <EmptyDescription>{state.description}</EmptyDescription>
      </EmptyHeader>
      {filtered && (
        <EmptyContent>
          <Button variant="outline" size="sm" className="h-11 md:h-8" asChild>
            <Link href={clearHref}>Clear filters</Link>
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
