import { fileURLToPath } from "node:url";
import { escapeMarkdown, type Guild, type GuildMember } from "discord.js";
import {
  planDiscordMessages,
  resolveMessage,
  validateMessage,
  type ApiActionRow,
  type ApiEmbed,
  type BannerSource,
  type BuiltMessage,
  type MessageIssue,
  type PlannedMessage,
  type ValidateOptions,
  type VariableValues,
} from "@repo/discord-message";

// Sends a message designed in web-admin's message builder, or updates the one
// already in the channel. Any feature can call it: welcome channel, rules,
// DMs, level-ups. Pure apart from the channel it is handed (no env, no DB), so
// callers store the returned ids and tests run against a fake channel.

export interface BuiltMessagePayload {
  embeds: ApiEmbed[];
  /** Always sent, empty included: on an edit that is what takes removed buttons away. */
  components: ApiActionRow[];
  files: { attachment: string; name: string; description?: string }[];
  allowedMentions: AllowedMentions;
}

type AllowedMentions = { parse: ("users" | "roles" | "everyone")[]; users?: string[] };

/** The slice of a discord.js channel this needs. Text channels, threads and DMs all fit. */
export interface BuiltMessageChannel {
  id: string;
  send(payload: BuiltMessagePayload): Promise<{ id: string }>;
  messages: {
    // `attachments: []` drops the old banner image; without it Discord keeps it next to the new one.
    edit(messageId: string, payload: BuiltMessagePayload & { attachments: [] }): Promise<{ id: string }>;
    delete(messageId: string): Promise<unknown>;
  };
}

export interface PublishBuiltMessageInput {
  channel: BuiltMessageChannel;
  message: BuiltMessage;
  /** Filled into [placeholders]. See guildVariableValues and memberVariableValues. */
  values: VariableValues;
  /** What an earlier publish left behind, so it gets updated instead of posted twice. */
  previous?: { channel: BuiltMessageChannel | null; messageIds: string[] } | null;
  /** Nothing pings by default. A join message passes `{ parse: [], users: [member.id] }`. */
  allowedMentions?: AllowedMentions;
  validate?: ValidateOptions;
  /** Uploaded banners must live under this URL (the CDN). Unset refuses every upload. */
  allowedUploadBase?: string;
  /** Local path or URL for a banner image. Tests swap it out. */
  resolveBannerFile?: (source: BannerSource) => string;
}

/** The message can't be sent as designed. `issues` are written for the admin. */
export class BuiltMessageError extends Error {
  constructor(readonly issues: MessageIssue[]) {
    super(issues[0]?.message ?? "The message can't be sent");
    this.name = "BuiltMessageError";
  }
}

/**
 * Discord failed partway. `messageIds` is everything of ours that may still be
 * in the channel; store it, so the next publish cleans up instead of doubling.
 */
export class BuiltMessageSendError extends Error {
  constructor(
    readonly messageIds: string[],
    override readonly cause: unknown,
  ) {
    super("Discord rejected part of the message");
    this.name = "BuiltMessageSendError";
  }
}

const UNKNOWN_MESSAGE = 10008;
const isUnknownMessage = (error: unknown) => (error as { code?: unknown } | null)?.code === UNKNOWN_MESSAGE;

const IMAGE_EXTENSION = /\.(png|jpe?g|gif)$/i;

function themeFilePath(source: BannerSource): string {
  if (source.kind === "upload") return source.url;
  return fileURLToPath(import.meta.resolve(`@repo/discord-message/assets/themes/${source.theme.file}`));
}

function toPayload(
  planned: PlannedMessage,
  index: number,
  allowedMentions: AllowedMentions,
  resolveBannerFile: (source: BannerSource) => string,
): BuiltMessagePayload {
  if (planned.kind === "embeds") return { embeds: planned.embeds, components: planned.components, files: [], allowedMentions };
  const file = resolveBannerFile(planned.source);
  const extension = IMAGE_EXTENSION.exec(file.split("?")[0] ?? "")?.[1]?.toLowerCase() ?? "png";
  return {
    embeds: [],
    components: [],
    files: [{ attachment: file, name: `banner-${index + 1}.${extension}`, ...(planned.altText && { description: planned.altText }) }],
    allowedMentions,
  };
}

function checkUploads(planned: PlannedMessage[], allowedUploadBase: string | undefined): MessageIssue[] {
  const base = allowedUploadBase ? `${allowedUploadBase.replace(/\/$/, "")}/` : null;
  return planned.flatMap((item) => {
    if (item.kind !== "banner" || item.source.kind !== "upload") return [];
    if (base && item.source.url.startsWith(base)) return [];
    return [
      {
        code: "image_type" as const,
        elementId: item.elementId,
        message: base ? "That banner image isn't one of our uploads. Upload it again." : "The bot isn't set up for uploaded banner images.",
      },
    ];
  });
}

/**
 * Posts the message in order, or brings an earlier publish in line with it:
 * messages that still exist are edited where they stand, extra ones are
 * deleted, new ones go at the end. If an old message is gone, or the channel
 * changed, everything is posted fresh so the order holds. Returns the ids now
 * in the channel, top to bottom.
 */
export async function publishBuiltMessage(input: PublishBuiltMessageInput): Promise<{ messageIds: string[] }> {
  const { channel, previous, allowedMentions = { parse: [] }, resolveBannerFile = themeFilePath } = input;

  // Limits are checked with the placeholders filled in: a long server name
  // can push a title over that fit in the builder.
  const resolved = resolveMessage(input.message, input.values);
  const planned = planDiscordMessages(resolved);
  const issues = [...validateMessage(resolved, input.validate), ...checkUploads(planned, input.allowedUploadBase)];
  if (issues.length > 0) throw new BuiltMessageError(issues);

  const payloads = planned.map((item, i) => toPayload(item, i, allowedMentions, resolveBannerFile));
  const oldIds = previous?.messageIds ?? [];
  const sameChannel = previous?.channel?.id === channel.id;
  const deleteOld = async (ids: string[]) => {
    // Already deleted by a mod, or the channel is gone: either way it's not there anymore.
    for (const id of ids) await previous?.channel?.messages.delete(id).catch(() => {});
  };

  const sent: string[] = [];
  let postFresh = !sameChannel;
  try {
    if (sameChannel) {
      for (const [i, payload] of payloads.entries()) {
        const oldId = oldIds[i];
        if (!oldId) {
          sent.push((await channel.send(payload)).id);
          continue;
        }
        try {
          sent.push((await channel.messages.edit(oldId, { ...payload, attachments: [] })).id);
        } catch (error) {
          if (!isUnknownMessage(error)) throw error;
          postFresh = true;
          break;
        }
      }
      if (!postFresh) await deleteOld(oldIds.slice(payloads.length));
    }

    if (postFresh) {
      await deleteOld([...new Set([...oldIds, ...sent])]);
      sent.length = 0;
      for (const payload of payloads) sent.push((await channel.send(payload)).id);
    }
  } catch (error) {
    const leftovers = postFresh ? [] : oldIds.slice(sent.length);
    throw new BuiltMessageSendError([...sent, ...leftovers], error);
  }

  return { messageIds: sent };
}

/** Values every feature can fill. Names are escaped so a server called **Bold** doesn't restyle the text. */
export function guildVariableValues(guild: Pick<Guild, "name" | "memberCount">): VariableValues {
  return {
    "server.name": escapeMarkdown(guild.name),
    "server.member_count": guild.memberCount.toLocaleString("en-US"),
  };
}

/** For messages about one member: welcome, goodbye, level-up. */
export function memberVariableValues(member: Pick<GuildMember, "id" | "displayName" | "guild">): VariableValues {
  return {
    ...guildVariableValues(member.guild),
    "member.mention": `<@${member.id}>`,
    "member.name": escapeMarkdown(member.displayName),
  };
}
