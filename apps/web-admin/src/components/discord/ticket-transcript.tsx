import type { Json } from "@repo/supabase";
import type { DiscordTicketMessage } from "@repo/supabase/queries/tickets";

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
import { Badge } from "@repo/ui";
import { formatBytes, formatDateTime } from "@/lib/discord/tickets";

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
function renderMentions(text: string, names: Map<string, string>): string {
  return text
    .replace(/<@!?(\d+)>/g, (_, id: string) => `@${names.get(id)?.replace(/^@/, "") ?? "unknown"}`)
    .replace(/<@&(\d+)>/g, (_, id: string) => names.get(id) ?? "@role")
    .replace(/<#(\d+)>/g, (_, id: string) => names.get(id) ?? "#channel");
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

function Embed({ embed, names }: { embed: StoredEmbed; names: Map<string, string> }) {
  if (isMediaEmbed(embed)) return <MediaEmbed embed={embed} />;
  const color = embed.color ? `#${embed.color.toString(16).padStart(6, "0")}` : undefined;
  return (
    <div className="mt-1.5 max-w-xl rounded-md border-l-4 bg-muted/40 px-3 py-2 text-sm" style={{ borderLeftColor: color }}>
      {embed.author?.name && (
        <p className="mb-1 flex items-center gap-1.5 text-xs font-medium">
          {embed.author.icon_url && (
            // eslint-disable-next-line @next/next/no-img-element -- embed author icon
            <img src={embed.author.icon_url} alt="" className="size-4 rounded-full" />
          )}
          {embed.author.name}
        </p>
      )}
      {embed.title && <p className="font-semibold">{renderMentions(embed.title, names)}</p>}
      {embed.description && <p className="whitespace-pre-wrap text-muted-foreground">{renderMentions(embed.description, names)}</p>}
      {embed.fields && embed.fields.length > 0 && (
        <dl className="mt-1.5 grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {embed.fields.map((field, i) => (
            <div key={i}>
              <dt className="text-xs font-medium">{renderMentions(field.name, names)}</dt>
              <dd className="whitespace-pre-wrap text-xs text-muted-foreground">{renderMentions(field.value, names)}</dd>
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

export function TicketTranscript({ messages, names }: { messages: TranscriptMessage[]; names: Map<string, string> }) {
  // Author names from the transcript itself cover mentions of people who wrote in the ticket.
  const allNames = new Map(names);
  for (const message of messages) {
    if (message.author_discord_id && !allNames.has(message.author_discord_id)) {
      allNames.set(message.author_discord_id, message.author_name);
    }
  }

  return (
    <ol className="space-y-4">
      {messages.map((message) => {
        const embeds = (message.embeds as Json[] as StoredEmbed[]) ?? [];
        const attachments = (message.attachments as Json[] as unknown as StoredAttachment[]) ?? [];
        return (
          <li key={message.id} className={message.deleted_at ? "flex gap-3 opacity-60" : "flex gap-3"}>
            {message.author_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- Discord CDN avatar
              <img src={message.author_avatar_url} alt="" className="size-9 shrink-0 rounded-full" loading="lazy" />
            ) : (
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                {message.author_name.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium">{message.author_name}</span>
                {message.author_is_bot && (
                  <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                    BOT
                  </Badge>
                )}
                <time className="text-xs text-muted-foreground tabular-nums" dateTime={message.created_at}>
                  {formatDateTime(message.created_at)}
                </time>
                {message.edited_at && <span className="text-xs text-muted-foreground">(edited)</span>}
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
              </div>
              {/* Like Discord: a message that's only a GIF/image link shows the media, not the URL. */}
              {message.content && !embeds.some((e) => isMediaEmbed(e) && e.url === message.content.trim()) && (
                <p className="whitespace-pre-wrap break-words text-sm">{renderMentions(message.content, allNames)}</p>
              )}
              {embeds.map((embed, i) => (
                <Embed key={i} embed={embed} names={allNames} />
              ))}
              {attachments.map((attachment) => (
                <Attachment key={attachment.id} attachment={attachment} />
              ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
