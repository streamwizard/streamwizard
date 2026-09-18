"use client";

import { Fragment, type ReactNode } from "react";
import type { Json } from "@repo/supabase";
import type { DiscordTicketMessage } from "@repo/supabase/queries/tickets";
import { Badge } from "@repo/ui";
import { formatBytes, formatDateTime, formatDay, formatTimeOfDay } from "@/lib/discord/tickets";
import { cn } from "@/lib/utils";

/** An archived message. Deleted ones are kept and shown as such, so staff can still read what a ticket was about. */
export type TranscriptMessage = Pick<
  DiscordTicketMessage,
  | "id"
  | "author_discord_id"
  | "author_name"
  | "author_avatar_url"
  | "author_is_bot"
  | "content"
  | "embeds"
  | "attachments"
  | "created_at"
  | "edited_at"
  | "deleted_at"
  | "pinned"
>;

interface StoredAttachment {
  id: string;
  name: string;
  size: number;
  content_type: string | null;
  /** Image preview source: the R2 copy. Null for files that weren't copied. */
  url: string | null;
}

interface StoredEmbed {
  type?: string;
  url?: string;
  author?: { name?: string; icon_url?: string };
  thumbnail?: { url?: string };
  image?: { url?: string };
  video?: { url?: string };
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string }[];
  footer?: { text?: string };
}

/** Swaps Discord mention syntax for readable names where we know them. */
function renderMentions(text: string, names: Record<string, string>): string {
  return text
    .replace(/<@!?(\d+)>/g, (_, id: string) => `@${names[id]?.replace(/^@/, "") ?? "unknown"}`)
    .replace(/<@&(\d+)>/g, (_, id: string) => names[id] ?? "@role")
    .replace(/<#(\d+)>/g, (_, id: string) => names[id] ?? "#channel");
}

// The bits of Discord markdown that show up in tickets: bold, italic, inline
// code and bare links. Everything else stays as typed. No HTML is produced,
// only React nodes, so message content can't inject markup.
const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|(?<![\w*])\*[^*\n]+\*(?![\w*])|(?<![\w*])_[^_\n]+_(?![\w*])|https?:\/\/[^\s<>)]+)/g;

function Inline({ text, names }: { text: string; names: Record<string, string> }) {
  const parts = renderMentions(text, names).split(INLINE);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("`")) {
          return (
            <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("*") || part.startsWith("_")) return <em key={i}>{part.slice(1, -1)}</em>;
        return (
          <a key={i} href={part} target="_blank" rel="noreferrer" className="break-all text-primary underline underline-offset-4">
            {part}
          </a>
        );
      })}
    </>
  );
}

/** GIF (gifv, e.g. Klipy) and plain image link embeds render as media, like in Discord. */
function MediaEmbed({ embed }: { embed: StoredEmbed }) {
  if (embed.type === "gifv" && embed.video?.url) {
    return (
      <video
        src={embed.video.url}
        poster={embed.thumbnail?.url}
        autoPlay
        loop
        muted
        playsInline
        className="mt-1.5 max-h-64 max-w-xs rounded-md"
      />
    );
  }
  const src = embed.image?.url ?? embed.thumbnail?.url;
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element -- embedded image link
  return <img src={src} alt="" className="mt-1.5 max-h-64 max-w-xs rounded-md" loading="lazy" />;
}

const isMediaEmbed = (embed: StoredEmbed) => embed.type === "gifv" || embed.type === "image";

function Embed({ embed, names }: { embed: StoredEmbed; names: Record<string, string> }) {
  if (isMediaEmbed(embed)) return <MediaEmbed embed={embed} />;
  const color = embed.color ? `#${embed.color.toString(16).padStart(6, "0")}` : undefined;
  // Discord's own embed look: a colored accent on the left edge, kept thin here.
  return (
    <div className="mt-1.5 max-w-xl rounded-md border border-l-2 bg-muted/40 px-3 py-2 text-sm" style={{ borderLeftColor: color }}>
      {embed.author?.name && (
        <p className="mb-1 flex items-center gap-1.5 text-xs font-medium">
          {embed.author.icon_url && (
            // eslint-disable-next-line @next/next/no-img-element -- embed author icon
            <img src={embed.author.icon_url} alt="" className="size-4 rounded-full" />
          )}
          {embed.author.name}
        </p>
      )}
      {embed.title && (
        <p className="font-semibold">
          <Inline text={embed.title} names={names} />
        </p>
      )}
      {embed.description && (
        <p className="whitespace-pre-wrap text-muted-foreground">
          <Inline text={embed.description} names={names} />
        </p>
      )}
      {embed.fields && embed.fields.length > 0 && (
        <dl className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {embed.fields.map((field, i) => (
            <div key={i}>
              <dt className="text-xs font-medium">
                <Inline text={field.name} names={names} />
              </dt>
              <dd className="whitespace-pre-wrap text-xs text-muted-foreground">
                <Inline text={field.value} names={names} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {embed.footer?.text && <p className="mt-1 text-xs text-muted-foreground">{embed.footer.text}</p>}
    </div>
  );
}

function Attachment({ attachment }: { attachment: StoredAttachment }) {
  if (attachment.url) {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="mt-1.5 block w-fit">
        {/* eslint-disable-next-line @next/next/no-img-element -- CDN copy of a small ticket screenshot */}
        <img src={attachment.url} alt={attachment.name} className="max-h-72 max-w-sm rounded-md border" loading="lazy" />
      </a>
    );
  }
  return (
    <div className="mt-1.5 w-fit rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground">
      {attachment.name} · {formatBytes(attachment.size)} · not saved
    </div>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- Discord CDN avatar
    return <img src={url} alt="" className="size-9 shrink-0 rounded-full" loading="lazy" />;
  }
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

const DASHBOARD_SUFFIX = " (via dashboard)";
const SYSTEM_MAX_CHARS = 200;
const GROUP_WINDOW_MS = 7 * 60_000;

// How a row reads once the bot's framing is peeled off: a person talking, a
// staff reply the bot relayed from this dashboard, or a one-line notice the
// bot posted about the ticket (claimed, moved, priority).
type Shape =
  | { kind: "person"; authorKey: string; name: string; avatarUrl: string | null; badge: null; body: string; embeds: StoredEmbed[] }
  | { kind: "person"; authorKey: string; name: string; avatarUrl: string | null; badge: "via dashboard"; body: string; embeds: [] }
  | { kind: "system"; body: string };

function shapeOf(message: TranscriptMessage, embeds: StoredEmbed[], attachments: StoredAttachment[]): Shape {
  if (message.author_is_bot) {
    const relay = embeds.length === 1 && attachments.length === 0 ? embeds[0] : null;
    if (relay?.author?.name?.endsWith(DASHBOARD_SUFFIX) && !relay.title && !relay.fields?.length) {
      const name = relay.author.name.slice(0, -DASHBOARD_SUFFIX.length);
      return { kind: "person", authorKey: `dashboard:${name}`, name, avatarUrl: relay.author.icon_url ?? null, badge: "via dashboard", body: relay.description ?? "", embeds: [] };
    }
    const single = !message.content.includes("\n") && message.content.length <= SYSTEM_MAX_CHARS;
    if (embeds.length === 0 && attachments.length === 0 && single) return { kind: "system", body: message.content };
  }
  return {
    kind: "person",
    authorKey: message.author_discord_id ?? message.author_name,
    name: message.author_name,
    avatarUrl: message.author_avatar_url,
    badge: null,
    body: message.content,
    embeds,
  };
}

const dayKey = (iso: string) => new Date(iso).toDateString();

interface Previous {
  shape: Shape;
  at: number;
  day: string;
}

/** Same person, a few minutes on, same day: one header serves the run. */
function continuesRun(previous: Previous | null, shape: Shape, at: number, day: string): boolean {
  if (!previous || previous.shape.kind !== "person" || shape.kind !== "person") return false;
  return previous.shape.authorKey === shape.authorKey && previous.day === day && at - previous.at < GROUP_WINDOW_MS;
}

/** Renders on the client so the ticket page can swap in fresh messages as they arrive. */
export function TicketTranscript({ messages, names }: { messages: TranscriptMessage[]; names: Record<string, string> }) {
  // Author names from the transcript itself cover mentions of people who wrote in the ticket.
  const allNames: Record<string, string> = { ...names };
  for (const message of messages) {
    if (message.author_discord_id && !(message.author_discord_id in allNames)) {
      allNames[message.author_discord_id] = message.author_name;
    }
  }

  const rows: ReactNode[] = [];
  // Assigned inside the loop; the assertion stops TypeScript narrowing it to null at the top.
  let previous = null as Previous | null;

  for (const message of messages) {
    const embeds = (message.embeds as Json[] as StoredEmbed[]) ?? [];
    const attachments = (message.attachments as Json[] as unknown as StoredAttachment[]) ?? [];
    const shape = shapeOf(message, embeds, attachments);
    const at = new Date(message.created_at).getTime();
    const day = dayKey(message.created_at);

    if (previous?.day !== day) {
      rows.push(
        <li key={`day-${day}`} className="flex items-center gap-3 py-1 text-xs text-muted-foreground first:pt-0" aria-label={formatDay(message.created_at)}>
          <span className="h-px flex-1 bg-border" aria-hidden />
          {formatDay(message.created_at)}
          <span className="h-px flex-1 bg-border" aria-hidden />
        </li>,
      );
    }

    const time = (
      <time className="text-xs text-muted-foreground tabular-nums" dateTime={message.created_at} title={formatDateTime(message.created_at)}>
        {formatTimeOfDay(message.created_at)}
      </time>
    );

    if (shape.kind === "system") {
      rows.push(
        <li key={message.id} className={cn("flex items-baseline gap-3 pl-12 text-xs text-muted-foreground", message.deleted_at && "line-through opacity-60")}>
          <span className="min-w-0 flex-1">
            <Inline text={shape.body} names={allNames} />
          </span>
          {time}
        </li>,
      );
      previous = { shape, at, day };
      continue;
    }

    const grouped = continuesRun(previous, shape, at, day);

    // Like Discord: a message that's only a GIF/image link shows the media, not the URL.
    const hideBody = !shape.body || shape.embeds.some((e) => isMediaEmbed(e) && e.url === shape.body.trim());
    const flags = (message.pinned || message.deleted_at) && (
      <span className="inline-flex items-center gap-1.5">
        {message.pinned && (
          <Badge variant="outline" className="px-1 py-0 text-[10px]">
            Pinned
          </Badge>
        )}
        {message.deleted_at && (
          <Badge variant="destructive" className="px-1 py-0 text-[10px]" title={`Deleted ${formatDateTime(message.deleted_at)}`}>
            Deleted
          </Badge>
        )}
      </span>
    );

    rows.push(
      <li key={message.id} className={cn("group flex gap-3", grouped ? "-mt-3" : "mt-1", message.deleted_at && "opacity-60")}>
        {grouped ? (
          <span className="w-9 shrink-0 pt-0.5 text-right text-[10px] leading-5 text-muted-foreground tabular-nums opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {formatTimeOfDay(message.created_at)}
          </span>
        ) : (
          <Avatar url={shape.avatarUrl} name={shape.name} />
        )}
        <div className="min-w-0 flex-1">
          {!grouped && (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-medium">{shape.name}</span>
              {shape.badge && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                  {shape.badge}
                </Badge>
              )}
              {message.author_is_bot && !shape.badge && (
                <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                  BOT
                </Badge>
              )}
              {time}
              {flags}
            </div>
          )}
          {!hideBody && (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              <Inline text={shape.body} names={allNames} />
              {message.edited_at && (
                <span className="ml-1 text-[10px] text-muted-foreground" title={`Edited ${formatDateTime(message.edited_at)}`}>
                  (edited)
                </span>
              )}
            </p>
          )}
          {grouped && flags}
          {shape.embeds.map((embed, i) => (
            <Embed key={i} embed={embed} names={allNames} />
          ))}
          {attachments.map((attachment) => (
            <Attachment key={attachment.id} attachment={attachment} />
          ))}
        </div>
      </li>,
    );
    previous = { shape, at, day };
  }

  return <ol className="space-y-4">{rows}</ol>;
}
