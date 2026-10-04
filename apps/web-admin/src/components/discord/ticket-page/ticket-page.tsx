"use client";

import { Fragment, useCallback, useEffect, useMemo, useReducer, useRef, useTransition } from "react";
import { ExternalLink, Link2Off, PanelRight } from "lucide-react";
import { toast } from "sonner";
import type { LinkedStreamWizardAccount } from "@repo/supabase/queries/discord";
import { formatTicketNumber } from "@repo/supabase/queries/tickets";
import { Alert, AlertDescription, AlertTitle, Button } from "@repo/ui";
import { getTicketSnapshot, listTicketMembersForDashboard, lookupDiscordNames } from "@/actions/discord-ticket-actions";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/widgets/responsive-dialog";
import { useTicketRealtime, type TicketRealtimeHandlers } from "@/hooks/use-ticket-realtime";
import { displayName } from "@/lib/discord/profile-names";
import type { TicketSnapshot } from "@/lib/discord/ticket-snapshot";
import { toTranscriptMessage } from "@/lib/discord/ticket-snapshot";
import { PRIORITY_LABELS, TICKET_TONE_DOT, formatDateTime, formatRelativeTime, priorityClass, ticketState } from "@/lib/discord/tickets";
import { cn } from "@/lib/utils";
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

  const standing = ticketState(ticket);
  const opener = displayName(ticket.opener_name, ticket.opener_discord_user_id, state.profiles);

  const discordLink = (className: string) => (
    <Button size="sm" variant="outline" className={className} asChild>
      <a href={`https://discord.com/channels/${config.guildId}/${ticket.channel_id}`} target="_blank" rel="noreferrer">
        Open in Discord
        <ExternalLink className="size-3.5" aria-hidden />
      </a>
    </Button>
  );

  const closeRequest = isOpen && ticket.close_requested_at && (
    <TicketCloseRequest
      ticketNumber={ticket.ticket_number}
      requestedAt={ticket.close_requested_at}
      expiresAt={ticket.close_request_expires_at}
      requestedBy={displayName(null, ticket.close_requested_by, state.profiles) ?? "the opener"}
      linked={config.linked}
    />
  );

  // The same panels twice: cards in the desktop column, flat sections in the
  // drawer the "Details" button opens below 1024px. CSS decides which one is
  // reachable, so nothing jumps while the page hydrates.
  const panels = (flat: boolean) => (
    <>
      <TicketDetails ticket={ticket} profiles={state.profiles} linkedAccount={config.linkedAccount} answers={config.answers} flat={flat} />
      {/* On a small screen the close request sits above the conversation instead, where it can't be missed. */}
      {!flat && closeRequest}
      {isOpen && (
        <TicketManage
          ticketNumber={ticket.ticket_number}
          subject={ticket.subject}
          priority={ticket.priority}
          category={ticket.category}
          categories={config.categories.filter((c) => c.active || c.slug === ticket.category).map((c) => ({ slug: c.slug, name: c.name }))}
          members={state.members}
          linked={config.linked}
          flat={flat}
        />
      )}
      <TicketTimeline ticket={ticket} events={state.events} profiles={state.profiles} flat={flat} />
    </>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 space-y-1">
          <h1 className="flex flex-wrap items-baseline gap-x-2 text-xl font-semibold">
            <span className="font-mono text-base font-normal text-muted-foreground">{formatTicketNumber(ticket.ticket_number)}</span>
            <span className="min-w-0 break-words">{ticket.subject}</span>
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 text-foreground" title={standing.hint}>
              <span aria-hidden className={cn("size-2 rounded-full", TICKET_TONE_DOT[standing.tone])} />
              {standing.label}
            </span>
            {ticket.priority && (
              <>
                <span aria-hidden>·</span>
                <span className={priorityClass(ticket.priority)}>{PRIORITY_LABELS[ticket.priority] ?? ticket.priority} priority</span>
              </>
            )}
            {[productLabel, categoryName].filter(Boolean).map((part) => (
              <Fragment key={part}>
                <span aria-hidden>·</span>
                <span>{part}</span>
              </Fragment>
            ))}
            <span aria-hidden>·</span>
            <span>
              Opened{" "}
              <time dateTime={ticket.created_at} title={formatDateTime(ticket.created_at)} suppressHydrationWarning>
                {formatRelativeTime(ticket.created_at)}
              </time>
              {opener && <> by {opener}</>}
            </span>
          </p>
        </div>
        {/* Claim and Close stay one tap away on a phone; everything else is behind Details. */}
        <div className="flex flex-wrap items-center gap-2">
          {isOpen && discordLink("hidden lg:inline-flex")}
          {isOpen && (
            <TicketActions
              ticketNumber={ticket.ticket_number}
              claimed={!!ticket.claimed_by_discord_user_id}
              claiming={category?.claimingEnabled !== false}
              linked={config.linked}
            />
          )}
          <ResponsiveDialog>
            <ResponsiveDialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-11 md:h-8 lg:hidden">
                <PanelRight className="size-3.5" aria-hidden />
                Details
              </Button>
            </ResponsiveDialogTrigger>
            <ResponsiveDialogContent className="max-h-[85dvh] overflow-y-auto">
              <ResponsiveDialogHeader>
                <ResponsiveDialogTitle>Ticket details</ResponsiveDialogTitle>
                <ResponsiveDialogDescription>
                  {formatTicketNumber(ticket.ticket_number)} {ticket.subject}
                </ResponsiveDialogDescription>
              </ResponsiveDialogHeader>
              <div className="space-y-6">
                {isOpen && discordLink("h-10 w-full")}
                {panels(true)}
              </div>
            </ResponsiveDialogContent>
          </ResponsiveDialog>
        </div>
      </div>

      {isOpen && !config.linked && (
        <Alert>
          <Link2Off />
          <AlertTitle>Your Discord account isn&apos;t linked</AlertTitle>
          <AlertDescription>
            Link it in StreamWizard and the bot can claim, reply and close as you. Until then this page is read-only.
          </AlertDescription>
        </Alert>
      )}

      {closeRequest && <div className="lg:hidden">{closeRequest}</div>}

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

        <div className="hidden space-y-6 lg:block">{panels(false)}</div>
      </div>
    </div>
  );
}
