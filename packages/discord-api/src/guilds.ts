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

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  bot?: boolean;
}

export interface DiscordMember {
  nick: string | null;
  avatar: string | null;
  user: DiscordUser;
}

export interface DiscordMessage {
  id: string;
  author: DiscordUser & { bot?: boolean };
  content: string;
  embeds: Record<string, unknown>[];
  attachments: { id: string; filename: string; size: number; content_type?: string; url: string }[];
  timestamp: string;
  edited_timestamp: string | null;
}

export interface DiscordApplicationCommand {
  id: string;
  name: string;
  description: string;
  /** Present on guild-scoped commands, absent on global ones. */
  guild_id?: string;
}

export class DiscordNotFoundError extends Error {
  constructor(path: string) {
    super(`Discord GET ${path}: not found`);
    this.name = "DiscordNotFoundError";
  }
}

function nullOnNotFound(error: unknown): null {
  if (error instanceof DiscordNotFoundError) return null;
  throw error;
}

// A 429 with a short wait is retried in place; anything longer surfaces as
// DiscordRateLimitError so the caller can decide.
const RETRY_429_MAX_SECONDS = 3;
const RETRY_429_ATTEMPTS = 2;

/**
 * Read-only guild lookups over REST with the bot token. Used by web-admin to
 * fill channel/role pickers, so it never touches the gateway. A 429 is
 * retried after Discord's retry_after when that's short; otherwise it throws
 * DiscordRateLimitError. Any other non-2xx throws a plain Error.
 */
export class DiscordGuildsClient {
  constructor(private readonly config: DiscordApiConfig) {}

  private async get<T>(path: string, attempt = 0): Promise<T> {
    const res = await fetch(`${DISCORD_API_BASE}${path}`, {
      headers: { Authorization: `Bot ${this.config.botToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) throw new DiscordNotFoundError(path);
    if (res.status === 429) {
      const body = (await res.json().catch(() => ({}))) as { retry_after?: number };
      const retryAfter = body.retry_after ?? 1;
      if (attempt < RETRY_429_ATTEMPTS && retryAfter <= RETRY_429_MAX_SECONDS) {
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000 + 50));
        return this.get<T>(path, attempt + 1);
      }
      throw new DiscordRateLimitError(retryAfter);
    }
    if (!res.ok) {
      throw new Error(`Discord GET ${path} failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  /** The guild member, or null when they're not in the server. */
  async getMember(userId: string): Promise<DiscordMember | null> {
    return this.get<DiscordMember>(`/guilds/${this.config.guildId}/members/${userId}`).catch(nullOnNotFound);
  }

  /** Members whose username or nickname starts with `query`. Discord matches prefixes only and returns at most 1000. */
  async searchMembers(query: string, limit = 10): Promise<DiscordMember[]> {
    const params = new URLSearchParams({ query, limit: String(Math.min(Math.max(limit, 1), 1000)) });
    return this.get<DiscordMember[]>(`/guilds/${this.config.guildId}/members/search?${params}`);
  }

  /** Any Discord user by id (works for people who left the server), or null. */
  async getUser(userId: string): Promise<DiscordUser | null> {
    return this.get<DiscordUser>(`/users/${userId}`).catch(nullOnNotFound);
  }

  /**
   * A channel's messages, oldest first, up to `max` (newest kept). Null when
   * the channel no longer exists.
   */
  async listChannelMessages(channelId: string, max = 1000): Promise<DiscordMessage[] | null> {
    const messages: DiscordMessage[] = [];
    let before: string | undefined;
    try {
      while (messages.length < max) {
        const query = `limit=100${before ? `&before=${before}` : ""}`;
        const batch = await this.get<DiscordMessage[]>(`/channels/${channelId}/messages?${query}`);
        messages.push(...batch);
        if (batch.length < 100) break;
        before = batch[batch.length - 1]?.id;
      }
    } catch (error) {
      return nullOnNotFound(error);
    }
    return messages.slice(0, max).reverse();
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
