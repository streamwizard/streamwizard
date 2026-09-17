import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getDiscordUserIdForUser, getLinkedStreamWizardAccount } from "@repo/supabase/queries/discord";
import { reportError } from "@repo/sentry";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  formatTicketNumber,
  getTicketByNumber,
  getTicketHistory,
  type DiscordTicketEvent,
} from "@repo/supabase/queries/tickets";
import {
  isActiveCategory,
  listTicketAnswers,
  listTicketCategories,
  listTicketProducts,
} from "@repo/supabase/queries/ticket-config";
import { listTicketMembers } from "@repo/supabase/queries/ticket-lifecycle";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { AutoRefresh } from "@/components/discord/auto-refresh";
import { TicketActions } from "@/components/discord/ticket-actions";
import { TicketManage } from "@/components/discord/ticket-manage";
import { TicketReply } from "@/components/discord/ticket-reply";
import { assertAdmin } from "@/lib/assert-admin";
import { TicketTranscript, type TranscriptMessage } from "@/components/discord/ticket-transcript";
import { getLiveTranscript } from "@/lib/discord/live-transcript";
import { PageHeader } from "@/components/widgets/page-header";
import { getGuildChannels, getGuildRoles, requireDiscordContext } from "@/lib/discord/api";
import { buildNameMap } from "@/lib/discord/names";
import { formatDateTime, TICKET_CLOSE_CAUSES } from "@/lib/discord/tickets";
import { displayName, resolveDiscordProfiles, type DiscordProfile } from "@/lib/discord/users";

export const dynamic = "force-dynamic";

const EVENT_LABELS: Record<string, string> = {
  opened: "Opened",
  claimed: "Claimed",
  unclaimed: "Released",
  closed: "Closed",
  member_added: "Added",
  member_removed: "Removed",
  moved: "Moved",
  transferred: "Handed to",
  priority_changed: "Priority changed",
  renamed: "Subject changed",
};

/** "Bug → Feature" for timeline entries that carry an old and a new value. Close codes and the like stay out. */
function eventChange(detail: unknown): string | null {
  if (!detail || typeof detail !== "object") return null;
  const { from, to } = detail as { from?: unknown; to?: unknown };
  if (typeof from !== "string" && typeof to !== "string") return null;
  return `${typeof from === "string" ? from : "none"} → ${typeof to === "string" ? to : "none"}`;
}

type TimelineEntry = Pick<DiscordTicketEvent, "id" | "type" | "actor_name" | "created_at"> &
  Partial<Pick<DiscordTicketEvent, "target_name" | "detail">>;

/** Name first, with the Discord username and id underneath for lookups. */
function DiscordPerson({
  id,
  stored,
  profiles,
}: {
  id: string | null;
  stored: string | null;
  profiles: Map<string, DiscordProfile>;
}) {
  const profile = id ? profiles.get(id) : undefined;
  const name = displayName(stored, id, profiles);
  if (!name) return <>Unknown</>;
  return (
    <span className="block">
      {name}
      {id && id !== "deleted" && (
        <span className="block font-mono text-xs text-muted-foreground">
          {profile && profile.username !== name ? `@${profile.username} · ` : ""}
          {id}
        </span>
      )}
    </span>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function DiscordTicketPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const ticketNumber = Number.parseInt(number, 10);
  if (!Number.isInteger(ticketNumber)) notFound();

  const { guildId } = requireDiscordContext();
  const ticket = await getTicketByNumber(supabaseAdmin, guildId, ticketNumber);
  if (!ticket) notFound();

  const adminUserId = await assertAdmin();
  const [{ messages, events }, linkedAccount, adminDiscordId, categories, products, answers, members] = await Promise.all([
    getTicketHistory(supabaseAdmin, ticket.id),
    getLinkedStreamWizardAccount(supabaseAdmin, ticket.opener_discord_user_id, ticket.opener_user_id),
    getDiscordUserIdForUser(supabaseAdmin, adminUserId),
    listTicketCategories(supabaseAdmin, guildId),
    listTicketProducts(supabaseAdmin, guildId),
    listTicketAnswers(supabaseAdmin, ticket.id),
    listTicketMembers(supabaseAdmin, ticket.id),
  ]);
  const productLabel = products.find((p) => p.slug === ticket.product)?.label ?? ticket.product;
  const categoryName = categories.find((c) => c.slug === ticket.category)?.name ?? ticket.category;
  // Open tickets aren't saved yet: read the channel live. Closed ones use the
  // stored transcript.
  const isOpen = ticket.status === "open";
  let liveMessages: TranscriptMessage[] | null = null;
  let liveFailed = false;
  if (isOpen) {
    try {
      liveMessages = await getLiveTranscript(ticket.channel_id);
    } catch (error) {
      liveFailed = true;
      reportError(error, "web-admin discord: live transcript", { ticket: ticket.ticket_number });
    }
  }

  // People mentioned in the conversation who didn't write in it (capped, one
  // Discord lookup each).
  const shown = liveMessages ?? messages;
  const authors = new Set(shown.map((m) => m.author_discord_id));
  const mentioned = [...JSON.stringify(shown.map((m) => [m.content, m.embeds])).matchAll(/<@!?(\d{17,20})>/g)]
    .map((match) => match[1] ?? "")
    .filter((id) => id && !authors.has(id))
    .slice(0, 25);

  // Look up every person on the ticket, so usernames show even when a name is stored.
  const profiles = await resolveDiscordProfiles([
    ticket.opener_discord_user_id,
    ticket.claimed_by_discord_user_id,
    ticket.closed_by_discord_user_id,
    ...events.filter((e) => !e.actor_name).map((e) => e.actor_discord_id),
    ...mentioned,
  ]);

  // Channel and role names for mentions. Old tickets must still render when
  // Discord is unreachable, so this is best-effort.
  let names = new Map<string, string>();
  try {
    const [channels, roles] = await Promise.all([getGuildChannels(), getGuildRoles()]);
    names = buildNameMap(channels, roles);
  } catch (error) {
    reportError(error, "web-admin discord: ticket names");
  }
  for (const [id, profile] of profiles) names.set(id, profile.name);
  if (ticket.opener_name) names.set(ticket.opener_discord_user_id, ticket.opener_name);
  if (ticket.claimed_by_discord_user_id && ticket.claimed_by_name) names.set(ticket.claimed_by_discord_user_id, ticket.claimed_by_name);

  const timeline: TimelineEntry[] = events.length
    ? events
    : // Tickets from before the timeline existed: rebuild what the row knows.
      [
        { id: "opened", type: "opened", actor_name: displayName(ticket.opener_name, ticket.opener_discord_user_id, profiles), created_at: ticket.created_at },
        ...(ticket.claimed_at
          ? [{ id: "claimed", type: "claimed", actor_name: displayName(ticket.claimed_by_name, ticket.claimed_by_discord_user_id, profiles), created_at: ticket.claimed_at }]
          : []),
        ...(ticket.closed_at
          ? [{ id: "closed", type: "closed", actor_name: displayName(ticket.closed_by_name, ticket.closed_by_discord_user_id, profiles), created_at: ticket.closed_at }]
          : []),
      ];

  return (
    <div className="space-y-6">
      <PageHeader title={`${formatTicketNumber(ticket.ticket_number)} ${ticket.subject}`} description={[productLabel, categoryName].filter(Boolean).join(" · ")}>
        <Button variant="outline" size="sm" asChild>
          <Link href="/discord/tickets">All tickets</Link>
        </Button>
        {ticket.status === "open" && (
          <TicketActions
            ticketNumber={ticket.ticket_number}
            claimed={!!ticket.claimed_by_discord_user_id}
            claiming={categories.find((c) => c.slug === ticket.category)?.claiming_enabled !== false}
            linked={!!adminDiscordId}
          />
        )}
        {ticket.status === "open" && (
          <Button size="sm" variant="outline" asChild>
            <a href={`https://discord.com/channels/${guildId}/${ticket.channel_id}`} target="_blank" rel="noreferrer">
              Open in Discord
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="order-2 lg:order-1">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
              Conversation
              {isOpen && liveMessages && (
                <AutoRefresh wsUrl={process.env.NEXT_PUBLIC_WS_SERVER_URL ?? null} channelId={ticket.channel_id} />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isOpen ? (
              liveFailed ? (
                <p className="text-sm text-muted-foreground">Couldn&apos;t load the conversation from Discord. Try refreshing.</p>
              ) : liveMessages === null ? (
                <p className="text-sm text-muted-foreground">
                  The ticket channel is gone from Discord, but the ticket is still marked open, so nothing was saved.
                </p>
              ) : (
                <div className="space-y-4">
                  {liveMessages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No messages in the ticket channel yet.</p>
                  ) : (
                    <TicketTranscript messages={liveMessages} names={names} />
                  )}
                  <TicketReply ticketNumber={ticket.ticket_number} />
                </div>
              )
            ) : ticket.transcript_purged_at ? (
              <p className="text-sm text-muted-foreground">
                This transcript was deleted on {formatDateTime(ticket.transcript_purged_at)}, 12 months after the ticket closed.
              </p>
            ) : messages.length > 0 ? (
              <TicketTranscript messages={messages} names={names} />
            ) : ticket.close_code === "channel_deleted" ? (
              <p className="text-sm text-muted-foreground">
                No transcript. The channel was deleted in Discord before the ticket was closed, and the conversation went with it.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No transcript. This ticket closed before transcripts were saved.</p>
            )}
          </CardContent>
        </Card>

        <div className="order-1 space-y-6 lg:order-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                Details
                <Badge variant={ticket.status === "open" ? "default" : "outline"}>{ticket.status === "open" ? "Open" : "Closed"}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <Detail label="Opened by">
                  <DiscordPerson id={ticket.opener_discord_user_id} stored={ticket.opener_name} profiles={profiles} />
                </Detail>
                <Detail label="Claimed by">
                  {ticket.claimed_by_discord_user_id || ticket.claimed_by_name ? (
                    <DiscordPerson id={ticket.claimed_by_discord_user_id} stored={ticket.claimed_by_name} profiles={profiles} />
                  ) : (
                    "Unclaimed"
                  )}
                </Detail>
                {ticket.closed_at && (
                  <Detail label="Closed by">
                    {ticket.closed_by_discord_user_id || ticket.closed_by_name ? (
                      <DiscordPerson id={ticket.closed_by_discord_user_id} stored={ticket.closed_by_name} profiles={profiles} />
                    ) : (
                      (TICKET_CLOSE_CAUSES[ticket.close_code ?? ""] ?? "Nobody")
                    )}
                  </Detail>
                )}
                {ticket.close_reason && <Detail label="Close reason">{ticket.close_reason}</Detail>}
                <Detail label="StreamWizard account">
                  {linkedAccount ? (
                    <span className="mt-1 flex items-center gap-2.5">
                      {linkedAccount.twitchAvatarUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- Twitch CDN avatar
                        <img src={linkedAccount.twitchAvatarUrl} alt="" className="size-8 rounded-full" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{linkedAccount.name}</span>
                        <a href={`mailto:${linkedAccount.email}`} className="block truncate text-xs text-muted-foreground hover:underline">
                          {linkedAccount.email}
                        </a>
                        {linkedAccount.twitchUsername && (
                          <a
                            href={`https://twitch.tv/${linkedAccount.twitchUsername}`}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-xs text-muted-foreground hover:underline"
                          >
                            twitch.tv/{linkedAccount.twitchUsername}
                          </a>
                        )}
                      </span>
                    </span>
                  ) : (
                    "Not linked"
                  )}
                </Detail>
                {ticket.github_issue_url && (
                  <Detail label="GitHub">
                    <a href={ticket.github_issue_url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                      Issue #{ticket.github_issue_number}
                    </a>
                  </Detail>
                )}
                {/* A form without a description field stores the answers written out instead; they follow below. */}
                {ticket.description && !(answers[0] && ticket.description.startsWith(`**${answers[0].label}**`)) && (
                  <Detail label="Description">
                    <span className="whitespace-pre-wrap">{ticket.description}</span>
                  </Detail>
                )}
                {answers.map((answer) => (
                  <Detail key={answer.id} label={answer.label}>
                    <span className="whitespace-pre-wrap">{answer.value || "Removed"}</span>
                  </Detail>
                ))}
              </dl>
            </CardContent>
          </Card>

          {isOpen && (
            <TicketManage
              // The server copy is the truth after every change: start over from it.
              key={`${ticket.subject}|${ticket.priority}|${ticket.category}`}
              ticketNumber={ticket.ticket_number}
              subject={ticket.subject}
              priority={ticket.priority}
              category={ticket.category}
              categories={categories
                .filter((c) => isActiveCategory(c) || c.slug === ticket.category)
                .map((c) => ({ slug: c.slug, name: c.name }))}
              members={members.map((m) => ({ id: m.discord_user_id, name: m.name ?? m.discord_user_id }))}
              linked={!!adminDiscordId}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 border-l pl-4">
                {timeline.map((event) => (
                  <li key={event.id} className="relative text-sm">
                    <span className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-foreground/60" aria-hidden />
                    <p>
                      <span className="font-medium">{EVENT_LABELS[event.type] ?? event.type}</span>
                      {event.target_name && <span>: {event.target_name}</span>}
                      {event.actor_name && <span className="text-muted-foreground"> by {event.actor_name}</span>}
                    </p>
                    {eventChange(event.detail) && <p className="text-xs text-muted-foreground">{eventChange(event.detail)}</p>}
                    <time className="text-xs text-muted-foreground tabular-nums" dateTime={event.created_at}>
                      {formatDateTime(event.created_at)}
                    </time>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
