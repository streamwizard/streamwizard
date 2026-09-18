"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useTransition } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { LinkedStreamWizardAccount } from "@repo/supabase/queries/discord";
import { formatTicketNumber } from "@repo/supabase/queries/tickets";
import { Button } from "@repo/ui";
import { getTicketSnapshot, listTicketMembersForDashboard, lookupDiscordNames } from "@/actions/discord-ticket-actions";
import { PageHeader } from "@/components/widgets/page-header";
import { useTicketRealtime, type TicketRealtimeHandlers } from "@/hooks/use-ticket-realtime";
import { displayName } from "@/lib/discord/profile-names";
import type { TicketSnapshot } from "@/lib/discord/ticket-snapshot";
import { toTranscriptMessage } from "@/lib/discord/ticket-snapshot";
import { TicketActions } from "../ticket-actions";
import { TicketCloseRequest } from "../ticket-close-request";
import { TicketManage } from "../ticket-manage";
import type { ReplyTag } from "../ticket-reply";
import { TicketConversation } from "./ticket-conversation";
import { TicketDetails, type TicketAnswer } from "./ticket-details";
import { initialTicketState, ticketReducer, unknownMentions } from "./ticket-store";
import { TicketTimeline } from "./ticket-timeline";

/** What doesn't change while the page is open. Read once by the server page. */
export interface TicketPageConfig {
  guildId: string;
  categories: { slug: string; name: string; active: boolean; claimingEnabled: boolean }[];
  products: { slug: string; label: string }[];
  answers: TicketAnswer[];
  tags: ReplyTag[];
  linkedAccount: LinkedStreamWizardAccount | null;
  /** The admin's Discord account is linked, so the bot can act as them. */
  linked: boolean;
}

const FALLBACK_POLL_MS = 30_000;

/**
 * One ticket, rendered from a server snapshot and then kept current by
 * Supabase Realtime. Staff actions here and in Discord all end as row writes
 * by the bot, so nothing on this page re-renders the server: the row arrives.
 */
export function TicketPage({ snapshot, config }: { snapshot: TicketSnapshot; config: TicketPageConfig }) {
  const [state, dispatch] = useReducer(ticketReducer, snapshot, initialTicketState);
  const [refreshing, startRefresh] = useTransition();
  const { ticket } = state;
  const isOpen = ticket.status === "open";

  const resync = useCallback(() => {
    startRefresh(async () => {
      const result = await getTicketSnapshot(ticket.ticket_number);
      if (result.error !== null) {
        toast.error(result.error);
        return;
      }
      dispatch({ type: "snapshot", snapshot: result });
    });
  }, [ticket.ticket_number]);

  // Names for people a new message or event mentions: one lookup per burst.
  const pendingIds = useRef(new Set<string>());
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const namesRef = useRef(state.names);
  useEffect(() => {
    namesRef.current = state.names;
  }, [state.names]);
  const queueNames = useCallback((texts: (string | null | undefined)[]) => {
    for (const id of unknownMentions(texts, namesRef.current)) pendingIds.current.add(id);
    if (pendingIds.current.size === 0 || lookupTimer.current) return;
    lookupTimer.current = setTimeout(async () => {
      lookupTimer.current = undefined;
      const ids = [...pendingIds.current];
      pendingIds.current.clear();
      const names = await lookupDiscordNames(ids);
      if (Object.keys(names).length) dispatch({ type: "names", names });
    }, 300);
  }, []);
  useEffect(() => () => clearTimeout(lookupTimer.current), []);

  const handlers = useMemo<TicketRealtimeHandlers>(
    () => ({
      onTicket: (row) => dispatch({ type: "ticket", ticket: row }),
      onMessage: (row) => {
        dispatch({ type: "message", message: toTranscriptMessage(row) });
        queueNames([row.content, JSON.stringify(row.embeds)]);
      },
      onEvent: (row) => dispatch({ type: "event", event: row }),
      onResync: resync,
    }),
    [queueNames, resync],
  );
  const status = useTicketRealtime(isOpen ? ticket.id : null, handlers);

  // Members aren't followed over realtime (their deletes can't be filtered);
  // the member_added/member_removed events say when to read the list again.
  useEffect(() => {
    if (!state.membersStale) return;
    let cancelled = false;
    void listTicketMembersForDashboard(ticket.ticket_number).then((result) => {
      if (cancelled || result.error !== null) return;
      dispatch({ type: "members", members: result.members });
    });
    return () => {
      cancelled = true;
    };
  }, [state.membersStale, ticket.ticket_number]);

  // Safety net while the live feed is down: a full snapshot every 30s, visible tab only.
  useEffect(() => {
    if (!isOpen || status === "subscribed") return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") resync();
    }, FALLBACK_POLL_MS);
    return () => clearInterval(timer);
  }, [isOpen, status, resync]);

  const category = config.categories.find((c) => c.slug === ticket.category);
  const productLabel = config.products.find((p) => p.slug === ticket.product)?.label ?? ticket.product;
  const categoryName = category?.name ?? ticket.category;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${formatTicketNumber(ticket.ticket_number)} ${ticket.subject}`}
        description={[productLabel, categoryName].filter(Boolean).join(" · ")}
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/discord/tickets">All tickets</Link>
        </Button>
        {isOpen && (
          <TicketActions
            ticketNumber={ticket.ticket_number}
            claimed={!!ticket.claimed_by_discord_user_id}
            claiming={category?.claimingEnabled !== false}
            linked={config.linked}
          />
        )}
        {isOpen && (
          <Button size="sm" variant="outline" asChild>
            <a
              href={`https://discord.com/channels/${config.guildId}/${ticket.channel_id}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Discord
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <TicketConversation
          ticket={ticket}
          messages={state.messages}
          names={state.names}
          tags={config.tags}
          status={status}
          refreshing={refreshing}
          onRefresh={resync}
        />

        <div className="order-1 space-y-6 lg:order-2">
          <TicketDetails
            ticket={ticket}
            profiles={state.profiles}
            linkedAccount={config.linkedAccount}
            answers={config.answers}
          />

          {isOpen && ticket.close_requested_at && (
            <TicketCloseRequest
              ticketNumber={ticket.ticket_number}
              requestedAt={ticket.close_requested_at}
              expiresAt={ticket.close_request_expires_at}
              requestedBy={displayName(null, ticket.close_requested_by, state.profiles) ?? "the opener"}
              linked={config.linked}
            />
          )}

          {isOpen && (
            <TicketManage
              ticketNumber={ticket.ticket_number}
              subject={ticket.subject}
              priority={ticket.priority}
              category={ticket.category}
              categories={config.categories
                .filter((c) => c.active || c.slug === ticket.category)
                .map((c) => ({ slug: c.slug, name: c.name }))}
              members={state.members}
              linked={config.linked}
            />
          )}

          <TicketTimeline ticket={ticket} events={state.events} profiles={state.profiles} />
        </div>
      </div>
    </div>
  );
}
