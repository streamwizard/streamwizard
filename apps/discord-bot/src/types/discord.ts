import {
  ContextMenuCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type ClientEvents,
  type ContextMenuCommandInteraction,
  type SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
  type SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void> | void;
  // Implement when a command has an autocomplete-enabled option (`.setAutocomplete(true)`).
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void> | void;
}

/** A right-click entry on a message or a member. Its name may contain spaces; it is what the permissions page keys on. */
export interface ContextMenuCommand {
  data: ContextMenuCommandBuilder;
  execute: (interaction: ContextMenuCommandInteraction) => Promise<void> | void;
}

export type AnyCommand = Command | ContextMenuCommand;

export const isContextMenuCommand = (command: AnyCommand): command is ContextMenuCommand =>
  command.data instanceof ContextMenuCommandBuilder;

export interface BotEvent<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute: (...args: ClientEvents[K]) => Promise<void> | void;
}
