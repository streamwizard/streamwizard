import type { ChatInputCommandInteraction, ContextMenuCommandInteraction } from "discord.js";
import { trackServer } from "@repo/posthog/server";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { getUserIdentity } from "@repo/supabase/queries/identity";
import { TtlCache } from "@repo/ttl-cache";

// Everyone who is not a linked StreamWizard account is filed under this one
// id. A Discord user id of someone who never signed up with us has no reason
// to be in our analytics; `linked: false` on the event says all that matters.
const UNLINKED = "discord:unlinked";

// Discord id -> StreamWizard account id (null = not linked). Commands come in
// bursts from the same few people, and an extra lookup per command would be
// most of what this bot asks the database.
const accounts = new TtlCache<string>({ ttlMs: 10 * 60_000, maxEntries: 5000 });

/**
 * Records that a command ran. Call without awaiting: the lookup must never be
 * why a reply was late, and a failure here is reported, not thrown.
 */
export async function trackCommand(
  interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction,
  ok: boolean,
): Promise<void> {
  try {
    const accountId = await accounts.fetch(interaction.user.id, async () => {
      const identity = await getUserIdentity(supabase, { discordUserId: interaction.user.id });
      return identity?.userId ?? null;
    });
    const subcommand = interaction.isChatInputCommand() ? interaction.options.getSubcommand(false) : null;
    trackServer(accountId ?? UNLINKED, "discord_command_used", {
      command: interaction.commandName,
      ...(subcommand ? { subcommand } : {}),
      kind: interaction.isChatInputCommand() ? "slash" : "context_menu",
      linked: accountId !== null,
      ok,
    });
  } catch (error) {
    reportError(error, "discord-bot commands: tracking", { command: interaction.commandName });
  }
}
