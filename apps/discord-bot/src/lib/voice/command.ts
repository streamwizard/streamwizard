import {
  DiscordAPIError,
  InteractionContextType,
  MessageFlags,
  RESTJSONErrorCodes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
  type User,
  type VoiceChannel,
} from "discord.js";
import type { Command } from "../../types/discord";
import { asTempVoiceChannel } from "./channel";
import { ownerRefusal, type TargetCheck, type TempChannel } from "./rules";
import { ensureLoaded, findOwnedChannel, getTempChannel } from "./store";

// Shared plumbing for the /voice-* commands, so each command file is its
// option list plus what it changes. Every answer is ephemeral.

export interface VoiceContext {
  interaction: ChatInputCommandInteraction<"cached">;
  member: GuildMember;
  channel: VoiceChannel;
  temp: TempChannel;
  ownerPresent: boolean;
}

const NOT_TEMP = "This only works in a temporary voice channel. Join one, or run it from that channel's chat.";
const MISSING_PERMISSIONS =
  "I'm missing a permission for that. I need Manage Channels, Manage Roles and Move Members on this channel.";

/** A guild-only slash command builder for a /voice-* command. */
export function voiceCommandData(name: string, description: string) {
  return new SlashCommandBuilder().setName(name).setDescription(description).setContexts(InteractionContextType.Guild);
}

/**
 * The temp channel the command is about: the one the member sits in, or the
 * one whose chat they typed in. Null when neither is a temp channel.
 */
async function resolveContext(interaction: ChatInputCommandInteraction<"cached">): Promise<VoiceContext | null> {
  await ensureLoaded();
  const member = interaction.member;
  for (const id of [member.voice.channelId, interaction.channelId]) {
    const temp = getTempChannel(id);
    const channel = asTempVoiceChannel(id ? interaction.guild.channels.cache.get(id) : null);
    if (temp && channel) return { interaction, member, channel, temp, ownerPresent: channel.members.has(temp.ownerId) };
  }
  return null;
}

const queues = new Map<string, Promise<unknown>>();

/**
 * Runs `fn` after any earlier change to the same channel has finished, so two
 * commands at once (a ban and a transfer, say) never compute permissions from
 * the same stale state.
 */
async function serialized<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const next = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(fn);
  queues.set(key, next);
  try {
    return await next;
  } finally {
    if (queues.get(key) === next) queues.delete(key);
  }
}

/**
 * Wraps a /voice-* command: finds the temp channel, checks ownership when
 * `ownerOnly`, and posts what `run` returns. Changes to one channel run one
 * at a time, each on the channel's latest state. A missing bot permission
 * gets its own answer instead of the generic error.
 */
export function voiceCommand({
  data,
  ownerOnly,
  run,
}: {
  data: Command["data"];
  ownerOnly: boolean;
  run: (ctx: VoiceContext) => Promise<string>;
}): Command {
  return {
    data,
    async execute(interaction) {
      if (!interaction.inCachedGuild()) {
        await interaction.reply({ content: "This only works in a server.", flags: MessageFlags.Ephemeral });
        return;
      }
      const found = await resolveContext(interaction);
      if (!found) {
        await interaction.reply({ content: NOT_TEMP, flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const content = await serialized(found.channel.id, async () => {
        const temp = getTempChannel(found.channel.id);
        if (!temp) return "This channel is gone.";
        const ctx = { ...found, temp, ownerPresent: found.channel.members.has(temp.ownerId) };
        const refusal = ownerOnly ? ownerRefusal(ctx.member.id, temp, ctx.ownerPresent) : null;
        if (refusal) return refusal;
        try {
          return await run(ctx);
        } catch (error) {
          if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.MissingPermissions) return MISSING_PERMISSIONS;
          throw error;
        }
      });
      await interaction.editReply({ content, allowedMentions: { parse: [] } });
    },
  };
}

/** The facts targetRefusal needs about the member an owner picked. */
export function targetCheck(ctx: VoiceContext, user: User, member: GuildMember | null): TargetCheck {
  const owned = findOwnedChannel(ctx.channel.guild.id, user.id);
  return {
    actorId: ctx.member.id,
    botId: ctx.channel.client.user.id,
    targetId: user.id,
    targetIsBot: user.bot,
    targetIsMember: member !== null,
    targetInChannel: ctx.channel.members.has(user.id),
    targetOwnsOther: owned && owned.channelId !== ctx.channel.id ? owned.channelId : null,
  };
}

/** Audit log reason for a change made through a command. */
export function reasonFor(ctx: VoiceContext, what: string): string {
  return `${what} by ${ctx.member.user.tag} (/${ctx.interaction.commandName})`;
}
