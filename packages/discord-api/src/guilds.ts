import { DiscordRateLimitError } from "./channel";
import type { DiscordApiConfig } from "./members";

const DISCORD_API_BASE = "https://discord.com/api/v10";

// Channel type numbers from the Discord API. Only the ones the dashboard
// pickers care about are named; everything else passes through as a number.
export const DiscordChannelType = {
  GuildText: 0,
  GuildVoice: 2,
  GuildCategory: 4,
  GuildAnnouncement: 5,
  GuildStageVoice: 13,
  GuildForum: 15,
} as const;

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner_id: string;
  system_channel_id: string | null;
  approximate_member_count?: number;
  approximate_presence_count?: number;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  parent_id: string | null;
  position: number;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
  /** Permission bitfield as a decimal string. */
  permissions: string;
}

export interface DiscordApplicationCommand {
  id: string;
  name: string;
  description: string;
  /** Present on guild-scoped commands, absent on global ones. */
  guild_id?: string;
}

/**
 * Read-only guild lookups over REST with the bot token. Used by web-admin to
 * fill channel/role pickers, so it never touches the gateway. A 429 throws
 * DiscordRateLimitError; any other non-2xx throws a plain Error.
 */
export class DiscordGuildsClient {
  constructor(private readonly config: DiscordApiConfig) {}

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${DISCORD_API_BASE}${path}`, {
      headers: { Authorization: `Bot ${this.config.botToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 429) {
      const body = (await res.json().catch(() => ({}))) as { retry_after?: number };
      throw new DiscordRateLimitError(body.retry_after ?? 1);
    }
    if (!res.ok) {
      throw new Error(`Discord GET ${path} failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  getGuild(): Promise<DiscordGuild> {
    return this.get(`/guilds/${this.config.guildId}?with_counts=true`);
  }

  listChannels(): Promise<DiscordChannel[]> {
    return this.get(`/guilds/${this.config.guildId}/channels`);
  }

  /** Includes @everyone (id === guild id) and managed bot roles; callers filter. */
  listRoles(): Promise<DiscordRole[]> {
    return this.get(`/guilds/${this.config.guildId}/roles`);
  }

  /**
   * Commands registered for this guild plus global ones. deploy-commands
   * registers to the guild when DISCORD_GUILD_ID is set and globally
   * otherwise, so reading both covers either setup. Guild entries win on a
   * name clash, matching what members see in Discord.
   */
  async listApplicationCommands(applicationId: string): Promise<DiscordApplicationCommand[]> {
    const [guildCommands, globalCommands] = await Promise.all([
      this.get<DiscordApplicationCommand[]>(`/applications/${applicationId}/guilds/${this.config.guildId}/commands`),
      this.get<DiscordApplicationCommand[]>(`/applications/${applicationId}/commands`),
    ]);
    const byName = new Map<string, DiscordApplicationCommand>();
    for (const command of globalCommands) byName.set(command.name, command);
    for (const command of guildCommands) byName.set(command.name, command);
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}
