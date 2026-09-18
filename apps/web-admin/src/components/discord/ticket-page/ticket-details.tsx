"use client";

import type { LinkedStreamWizardAccount } from "@repo/supabase/queries/discord";
import type { DiscordTicket } from "@repo/supabase/queries/tickets";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { displayName, type DiscordProfile } from "@/lib/discord/profile-names";
import { PRIORITY_LABELS, TICKET_CLOSE_CAUSES, formatDateTime, formatRelativeTime, priorityClass } from "@/lib/discord/tickets";

export interface TicketAnswer {
  id: string;
  label: string;
  value: string;
}

/** Name first, with the Discord username and id underneath for lookups. */
function DiscordPerson({
  id,
  stored,
  profiles,
}: {
  id: string | null;
  stored: string | null;
  profiles: Record<string, DiscordProfile>;
}) {
  const profile = id ? profiles[id] : undefined;
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

/** Relative on the page, exact on hover. The client clock differs from the server's, so the text may shift on hydration. */
function When({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} title={formatDateTime(iso)} suppressHydrationWarning>
      {formatRelativeTime(iso)}
    </time>
  );
}

export function TicketDetails({
  ticket,
  profiles,
  linkedAccount,
  answers,
}: {
  ticket: DiscordTicket;
  profiles: Record<string, DiscordProfile>;
  linkedAccount: LinkedStreamWizardAccount | null;
  answers: TicketAnswer[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Details</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Detail label="Priority">
              {ticket.priority ? (
                <span className={priorityClass(ticket.priority)}>{PRIORITY_LABELS[ticket.priority] ?? ticket.priority}</span>
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </Detail>
            <Detail label="Opened">
              <When iso={ticket.created_at} />
            </Detail>
            {ticket.closed_at && (
              <Detail label="Closed">
                <When iso={ticket.closed_at} />
              </Detail>
            )}
            {ticket.status === "open" && ticket.stale_warned_at && (
              <Detail label="Quiet since">
                <span title="The opener was reminded that the ticket went quiet. A reply clears this.">
                  <When iso={ticket.stale_warned_at} />
                </span>
              </Detail>
            )}
          </div>
          <Detail label="Opened by">
            <DiscordPerson id={ticket.opener_discord_user_id} stored={ticket.opener_name} profiles={profiles} />
          </Detail>
          {ticket.created_by_discord_user_id && (
            <Detail label="Opened for them by">
              <DiscordPerson id={ticket.created_by_discord_user_id} stored={null} profiles={profiles} />
            </Detail>
          )}
          {ticket.references_message_url && (
            <Detail label="About">
              <a
                href={ticket.references_message_url}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                A message in Discord
              </a>
            </Detail>
          )}
          <Detail label="Claimed by">
            {ticket.claimed_by_discord_user_id || ticket.claimed_by_name ? (
              <DiscordPerson
                id={ticket.claimed_by_discord_user_id}
                stored={ticket.claimed_by_name}
                profiles={profiles}
              />
            ) : (
              "Unclaimed"
            )}
          </Detail>
          {ticket.closed_at && (
            <Detail label="Closed by">
              {ticket.closed_by_discord_user_id || ticket.closed_by_name ? (
                <DiscordPerson
                  id={ticket.closed_by_discord_user_id}
                  stored={ticket.closed_by_name}
                  profiles={profiles}
                />
              ) : (
                (TICKET_CLOSE_CAUSES[ticket.close_code ?? ""] ?? "Nobody")
              )}
            </Detail>
          )}
          {ticket.close_reason && <Detail label="Close reason">{ticket.close_reason}</Detail>}
          {ticket.feedback_rating && (
            <Detail label="Opener's rating">
              <span
                aria-label={`${ticket.feedback_rating} out of 5`}
                title={ticket.feedback_at ? formatDateTime(ticket.feedback_at) : undefined}
              >
                {"★".repeat(ticket.feedback_rating)}
                <span className="text-muted-foreground">{"★".repeat(5 - ticket.feedback_rating)}</span>{" "}
                {ticket.feedback_rating}/5
              </span>
              {ticket.feedback_comment && (
                <span className="mt-1 block whitespace-pre-wrap text-muted-foreground">{ticket.feedback_comment}</span>
              )}
            </Detail>
          )}
          <Detail label="StreamWizard account">
            {linkedAccount ? (
              <span className="mt-1 flex items-center gap-2.5">
                {linkedAccount.twitchAvatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- Twitch CDN avatar
                  <img src={linkedAccount.twitchAvatarUrl} alt="" className="size-8 rounded-full" />
                )}
                <span className="min-w-0">
                  <span className="block truncate font-medium">{linkedAccount.name}</span>
                  <a
                    href={`mailto:${linkedAccount.email}`}
                    className="block truncate text-xs text-muted-foreground hover:underline"
                  >
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
              <a
                href={ticket.github_issue_url}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
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
  );
}
