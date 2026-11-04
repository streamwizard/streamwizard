import { TtlCache } from "@repo/ttl-cache";
import type { getEnabledCommandsByChannel } from "@repo/supabase/queries/commands";

type ChannelCommandRows = Awaited<ReturnType<typeof getEnabledCommandsByChannel>>;
type CommandRow = ChannelCommandRows[number];
type CommandData = NonNullable<CommandRow["custom_commands"] | CommandRow["default_chat_commands"]>;

export interface MatchedCommand {
  source: "custom" | "default";
  data: CommandData;
}

/**
 * A channel's enabled commands change only when the streamer edits them, but
 * every chat message starting with "!" asks for them, commands meant for other
 * bots included. A minute of staleness after an edit is the price of not
 * querying Supabase per message.
 */
const COMMANDS_TTL_MS = 60 * 1000;

/**
 * Enabled commands by trigger. The first row with a trigger wins, and within a
 * row the custom command beats the default one, the same order the handler
 * used to match in.
 */
export function indexCommands(rows: ChannelCommandRows): ReadonlyMap<string, MatchedCommand> {
  const byTrigger = new Map<string, MatchedCommand>();
  for (const row of rows) {
    const custom = row.custom_commands;
    if (custom && !byTrigger.has(custom.command)) byTrigger.set(custom.command, { source: "custom", data: custom });
    const fallback = row.default_chat_commands;
    if (fallback && !byTrigger.has(fallback.command)) byTrigger.set(fallback.command, { source: "default", data: fallback });
  }
  return byTrigger;
}

/**
 * Per-channel read-through cache of the enabled commands. The whole set is
 * cached, an empty one included, so an unknown "!command" is answered from
 * memory too. A failed load isn't cached; the next message retries.
 */
export function createCommandLookup(
  load: (channelId: string) => Promise<ChannelCommandRows>,
  options: { ttlMs?: number; now?: () => number } = {},
) {
  const cache = new TtlCache<ReadonlyMap<string, MatchedCommand>>({
    ttlMs: options.ttlMs ?? COMMANDS_TTL_MS,
    now: options.now,
  });

  return {
    async find(channelId: string, trigger: string): Promise<MatchedCommand | null> {
      const commands = await cache.fetch(channelId, async () => indexCommands(await load(channelId)));
      return commands?.get(trigger) ?? null;
    },
    /** Drops a channel's commands so the next message reloads them. */
    invalidate(channelId: string): void {
      cache.delete(channelId);
    },
  };
}
