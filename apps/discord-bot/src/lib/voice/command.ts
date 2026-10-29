import {
  DiscordAPIError,
  InteractionContextType,
  MessageFlags,
  RESTJSONErrorCodes,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
  type GuildMember,
  type User,
  type VoiceChannel,
} from "discord.js";
import type { Command } from "../../types/discord";
import { asTempVoiceChannel, refreshVoicePanel } from "./channel";
import { ownerRefusal, type TargetCheck, type TempChannel } from "./rules";
import { ensureLoaded, findOwnedChannel, getStaffRoleIds, getTempChannel } from "./store";

// Shared plumbing for the /voice-* commands, so each command file is its
// option list plus what it changes. Every answer is ephemeral.

export type VoiceInteraction =
  | ChatInputCommandInteraction<"cached">
  | ButtonInteraction<"cached">
  | ModalSubmitInteraction<"cached">;

export interface VoiceContext<I extends VoiceInteraction = ChatInputCommandInteraction<"cached">> {
  interaction: I;
  /** Where the change came from, for the audit log: "/voice-lock", "the Reset button". */
  source: string;
  member: GuildMember;
  channel: VoiceChannel;
  temp: TempChannel;
  ownerPresent: boolean;
  /** This channel's voice staff roles (its hub's, or the server's). */
  staffRoleIds: string[];
}

const NOT_TEMP = "This only works in a temporary voice channel. Join one, or run it from that channel's chat.";
const MISSING_PERMISSIONS =
  "I'm missing a permission for that. I need Manage Channels, Manage Roles, Move Members and Create Invite on this channel.";

/** A guild-only slash command builder for a /voice-* command. */
export function voiceCommandData(name: string, description: string) {
  return new SlashCommandBuilder().setName(name).setDescription(description).setContexts(InteractionContextType.Guild);
}

/**
 * The temp channel the command is about: the one the member sits in, or the
 * one whose chat they typed in. A button (or its modal) is about the channel
 * whose pinned message it's on, wherever the member sits. Null when neither
 * is a temp channel.
 */
export async function resolveContext<I extends VoiceInteraction>(
  interaction: I,
  source: string,
): Promise<Omit<VoiceContext<I>, "staffRoleIds"> | null> {
  await ensureLoaded();
  const member = interaction.member;
  const ids = interaction.isChatInputCommand()
    ? [member.voice.channelId, interaction.channelId]
    : [interaction.channelId];
  for (const id of ids) {
    const temp = getTempChannel(id);
    const channel = asTempVoiceChannel(id ? interaction.guild.channels.cache.get(id) : null);
    if (temp && channel) return { interaction, source, member, channel, temp, ownerPresent: channel.members.has(temp.ownerId) };
  }
  return null;
}

const queues = new Map<string, Promise<unknown>>();

/**
 * Runs `fn` after any earlier change to the same channel has finished, so two
 * commands at once (a ban and a transfer, say) never compute permissions from
 * the same stale state.
 */
export async function serialized<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const next = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(fn);
  queues.set(key, next);
  try {
    return await next;
  } finally {
    if (queues.get(key) === next) queues.delete(key);
  }
}

interface VoiceAction<I extends VoiceInteraction> {
  /** Only the owner, or the channel's voice staff on their behalf. */
  ownerOnly: boolean;
  run: (ctx: VoiceContext<I>) => Promise<string>;
}

/**
 * Runs a change to the temp channel for a /voice-* command or a button on its
 * pinned message: finds the channel, checks ownership when `ownerOnly` (voice
 * staff pass that check in every channel they're staff in), and
 * answers with what `run` returns. Changes to one channel run one at a time,
 * each on the channel's latest state. A missing bot permission gets its own
 * answer instead of the generic error. Ends by updating the pinned settings.
 */
export async function runVoiceAction<I extends VoiceInteraction>(
  interaction: I,
  source: string,
  { ownerOnly, run }: VoiceAction<I>,
): Promise<void> {
  const found = await resolveContext(interaction, source);
  if (!found) {
    await interaction.reply({ content: NOT_TEMP, flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const content = await serialized(found.channel.id, async () => {
    const temp = getTempChannel(found.channel.id);
    if (!temp) return "This channel is gone.";
    const ctx: VoiceContext<I> = {
      ...found,
      temp,
      ownerPresent: found.channel.members.has(temp.ownerId),
      staffRoleIds: await getStaffRoleIds(found.channel.guild.id, temp.hubId),
    };
    const refusal = ownerOnly && !isVoiceStaff(ctx.member, ctx.staffRoleIds) ? ownerRefusal(ctx.member.id, temp, ctx.ownerPresent) : null;
    if (refusal) return refusal;
    try {
      return await run(ctx);
    } catch (error) {
      if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.MissingPermissions) return MISSING_PERMISSIONS;
      throw error;
    }
  });
  await interaction.editReply({ content, allowedMentions: { parse: [] } });
  // After the answer, in the channel's queue, so updates land in order.
  await serialized(found.channel.id, () => refreshVoicePanel(found.channel));
}

/** A /voice-* command: its option list plus what it changes, run through runVoiceAction. */
export function voiceCommand({
  data,
  ...action
}: VoiceAction<ChatInputCommandInteraction<"cached">> & { data: Command["data"] }): Command {
  return {
    data,
    async execute(interaction) {
      if (!interaction.inCachedGuild()) {
        await interaction.reply({ content: "This only works in a server.", flags: MessageFlags.Ephemeral });
        return;
      }
      await runVoiceAction(interaction, `/${interaction.commandName}`, action);
    },
  };
}

/** Whether `member` has one of the channel's voice staff roles. */
export function isVoiceStaff(member: GuildMember | null, staffRoleIds: readonly string[]): boolean {
  return !!member && staffRoleIds.some((id) => member.roles.cache.has(id));
}

/** The facts targetRefusal needs about the member an owner picked. */
export function targetCheck(ctx: VoiceContext<VoiceInteraction>, user: User, member: GuildMember | null): TargetCheck {
  const owned = findOwnedChannel(ctx.channel.guild.id, user.id);
  return {
    actorId: ctx.member.id,
    botId: ctx.channel.client.user.id,
    targetId: user.id,
    targetIsBot: user.bot,
    targetIsMember: member !== null,
    targetInChannel: ctx.channel.members.has(user.id),
    targetOwnsOther: owned && owned.channelId !== ctx.channel.id ? owned.channelId : null,
    targetIsStaff: isVoiceStaff(member, ctx.staffRoleIds),
  };
}

/** Audit log reason for a change made through a command. */
export function reasonFor(ctx: Pick<VoiceContext<VoiceInteraction>, "member" | "source">, what: string): string {
  return `${what} by ${ctx.member.user.tag} (${ctx.source})`;
}
