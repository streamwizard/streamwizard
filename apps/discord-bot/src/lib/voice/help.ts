import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  LabelBuilder,
  ModalBuilder,
  TextDisplayBuilder,
  UserSelectMenuBuilder,
} from "discord.js";
import { TWITCH_PURPLE } from "../branding";

// The message the bot posts and pins in a new temp channel's chat: the
// /voice-* command list, so members find the commands without digging through
// the slash menu, and the channel's current settings under it. Names and order
// live here; descriptions come from the registered commands, so the list can't
// drift from what the commands say about themselves.

export const VOICE_HELP_GROUPS = [
  {
    title: "For the owner and voice staff",
    commands: [
      "voice-lock",
      "voice-unlock",
      "voice-hide",
      "voice-reveal",
      "voice-limit",
      "voice-invite",
      "voice-rename",
      "voice-kick",
      "voice-ban",
      "voice-unban",
      "voice-transfer",
      "voice-reset",
    ],
  },
  { title: "For anyone", commands: ["voice-claim", "voice-owner"] },
] as const;

/** Staff-only commands members can't run, so the list leaves them out. */
export const VOICE_HELP_LEFT_OUT = ["voice-clean", "voice-rename-block", "voice-rename-unblock"] as const;

/** The command list's title. The bot finds its pinned message by it after a restart. */
export const VOICE_HELP_TITLE = "Your voice channel";

const INTRO = "Run these in this chat or while you're in the channel. It's deleted when the last person leaves.";

/** The parts of a registered slash command the list shows. */
export interface HelpCommand {
  name: string;
  description: string;
  options?: readonly { name: string; required?: boolean }[];
}

/** `</name:id>` when the command's id is known, so it fills in on click; plain text otherwise. */
export function commandMention(name: string, id: string | undefined): string {
  return id ? `</${name}:${id}>` : `\`/${name}\``;
}

/**
 * One section per group: each command's mention, its required options as
 * `[name]`, and its description underneath. Commands that aren't registered
 * are left out, and so is a group with none left.
 */
export function buildVoiceHelpEmbed(
  commands: ReadonlyMap<string, HelpCommand>,
  ids: ReadonlyMap<string, string>,
): EmbedBuilder {
  const sections = VOICE_HELP_GROUPS.flatMap((group) => {
    const lines = group.commands.flatMap((name) => {
      const command = commands.get(name);
      if (!command) return [];
      const options = (command.options ?? [])
        .filter((option) => option.required)
        .map((option) => ` \`[${option.name}]\``)
        .join("");
      return [`${commandMention(name, ids.get(name))}${options}\n${command.description}`];
    });
    return lines.length > 0 ? [`**${group.title}**\n${lines.join("\n")}`] : [];
  });

  return new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setTitle(VOICE_HELP_TITLE)
    .setDescription([INTRO, ...sections].join("\n\n"));
}

/** What the settings part of the pinned message shows. */
export interface VoiceSettingsView {
  ownerId: string;
  locked: boolean;
  hidden: boolean;
  /** 0 is no limit. */
  userLimit: number;
  bannedUserIds: readonly string[];
  /** Whether the channel's lobby remembers owner settings. Null when the lobby is gone. */
  remembers: boolean | null;
  /** Voice staff blocked the owner from renaming. */
  renameBlocked?: boolean;
}

/** Bans listed by name; past this the rest is a count. */
export const SETTINGS_BANNED_SHOWN = 10;

function accessLabel(locked: boolean, hidden: boolean): string {
  if (locked && hidden) return "Locked and hidden";
  if (locked) return "Locked";
  if (hidden) return "Hidden";
  return "Open";
}

function bannedLabel(ids: readonly string[]): string {
  if (ids.length === 0) return "Nobody";
  const shown = ids.slice(0, SETTINGS_BANNED_SHOWN).map((id) => `<@${id}>`).join(", ");
  const rest = ids.length - SETTINGS_BANNED_SHOWN;
  return rest > 0 ? `${shown} and ${rest} more` : shown;
}

function rememberLabel(remembers: boolean | null): string | null {
  if (remembers === null) return null;
  return remembers ? "Your next channel from this lobby starts with these." : "This lobby doesn't remember settings.";
}

/** The channel's settings as they are now. Mentions in an embed never ping. */
export function buildVoiceSettingsEmbed(view: VoiceSettingsView): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setTitle("Current settings")
    .addFields(
      { name: "Owner", value: `<@${view.ownerId}>`, inline: true },
      { name: "Access", value: accessLabel(view.locked, view.hidden), inline: true },
      { name: "User limit", value: view.userLimit === 0 ? "No limit" : `${view.userLimit} people`, inline: true },
      { name: "Banned", value: bannedLabel(view.bannedUserIds) },
    );
  if (view.renameBlocked) embed.addFields({ name: "Renaming", value: "Blocked by voice staff" });
  const footer = rememberLabel(view.remembers);
  return footer ? embed.setFooter({ text: footer }) : embed;
}

// Custom ids of the pinned message's buttons and the Invite modal. Routed by
// id alone, so they keep working after a restart.
export const VOICE_INVITE_BUTTON_ID = "voice:invite";
export const VOICE_RESET_BUTTON_ID = "voice:reset";
export const VOICE_INVITE_MODAL_ID = "voice:invite-modal";
export const VOICE_INVITE_MEMBERS_FIELD = "members";
/** Members the Invite modal takes at once. */
export const VOICE_INVITE_PICK_MAX = 5;

/** The buttons under the settings: Invite (/voice-invite) and Reset (/voice-reset). */
export function buildVoicePanelButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(VOICE_INVITE_BUTTON_ID).setLabel("Invite").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(VOICE_RESET_BUTTON_ID).setLabel("Reset to defaults").setStyle(ButtonStyle.Secondary),
  );
}

/**
 * The Invite button's modal: a one-time link for someone outside the server,
 * as a plain link to copy, or why there isn't one, and a picker for members
 * who are already in it.
 */
export function buildVoiceInviteModal(link: { ok: true; url: string } | { ok: false; refusal: string }): ModalBuilder {
  const text = link.ok
    ? [
        "**Not in the server? Send them this link**",
        link.url,
        "-# Works once, for an hour. It gets them in here, even when the channel is locked.",
      ].join("\n")
    : link.refusal;
  return new ModalBuilder()
    .setCustomId(VOICE_INVITE_MODAL_ID)
    .setTitle("Invite someone")
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Already in the server? Pick them")
        .setDescription("I'll DM them a link, or ping them in this chat when their DMs are closed.")
        .setUserSelectMenuComponent(
          new UserSelectMenuBuilder()
            .setCustomId(VOICE_INVITE_MEMBERS_FIELD)
            .setMinValues(0)
            .setMaxValues(VOICE_INVITE_PICK_MAX)
            .setRequired(false),
        ),
    );
}
