import { DiscordMemberNotFoundError, DiscordRoleNotFoundError } from "./errors";

const UNKNOWN_MEMBER = 10007;
const UNKNOWN_ROLE = 10011;

export interface DiscordApiConfig {
  botToken: string;
  guildId: string;
}

export class DiscordMembersClient {
  constructor(private readonly config: DiscordApiConfig) {}

  private async setRole(discordUserId: string, roleId: string, method: "PUT" | "DELETE"): Promise<void> {
    const action = method === "PUT" ? "assign" : "remove";
    const actionPast = method === "PUT" ? "assigned" : "removed";

    const response = await fetch(
      `https://discord.com/api/v10/guilds/${this.config.guildId}/members/${discordUserId}/roles/${roleId}`,
      {
        method,
        headers: { Authorization: `Bot ${this.config.botToken}` },
      }
    );

    if (!response.ok && response.status !== 204) {
      const body = await response.text();

      // Discord error code 10007 = "Unknown Member": the user hasn't joined
      // the guild yet, so there's no member to attach a role to. 10011 =
      // "Unknown Role": the role was deleted after it was configured.
      const parsedCode: unknown = (() => {
        try {
          return JSON.parse(body).code;
        } catch {
          return undefined;
        }
      })();
      if (response.status === 404 && parsedCode === UNKNOWN_MEMBER) {
        throw new DiscordMemberNotFoundError(discordUserId);
      }
      if (response.status === 404 && parsedCode === UNKNOWN_ROLE) {
        throw new DiscordRoleNotFoundError(roleId);
      }

      console.error(`[discord-api/members] Failed to ${action} role ${roleId} for user ${discordUserId}: ${response.status} ${body}`);
      throw new Error(`Discord role ${method} failed: ${response.status} ${body}`);
    }

    console.log(`[discord-api/members] Successfully ${actionPast} role ${roleId} for user ${discordUserId}`);
  }

  /**
   * Bans a user from the guild, member or not, and optionally deletes their
   * messages from the last `deleteMessageSeconds` (max 7 days). Needs Ban
   * Members, and the bot's top role above theirs. `reason` shows in the
   * server's audit log.
   */
  async ban(discordUserId: string, options: { reason?: string; deleteMessageSeconds?: number } = {}): Promise<void> {
    const response = await fetch(`https://discord.com/api/v10/guilds/${this.config.guildId}/bans/${discordUserId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bot ${this.config.botToken}`,
        "Content-Type": "application/json",
        ...(options.reason ? { "X-Audit-Log-Reason": encodeURIComponent(options.reason.slice(0, 512)) } : {}),
      },
      body: JSON.stringify(
        options.deleteMessageSeconds ? { delete_message_seconds: Math.min(options.deleteMessageSeconds, 604_800) } : {},
      ),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Discord ban failed: ${response.status} ${await response.text()}`);
    }
  }

  /** Lifts a ban. A user who isn't banned (404) counts as done. */
  async unban(discordUserId: string, reason?: string): Promise<void> {
    const response = await fetch(`https://discord.com/api/v10/guilds/${this.config.guildId}/bans/${discordUserId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bot ${this.config.botToken}`,
        ...(reason ? { "X-Audit-Log-Reason": encodeURIComponent(reason.slice(0, 512)) } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Discord unban failed: ${response.status} ${await response.text()}`);
    }
  }

  /** Whether the user is banned from the guild. */
  async isBanned(discordUserId: string): Promise<boolean> {
    const response = await fetch(`https://discord.com/api/v10/guilds/${this.config.guildId}/bans/${discordUserId}`, {
      headers: { Authorization: `Bot ${this.config.botToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`Discord ban lookup failed: ${response.status} ${await response.text()}`);
    return true;
  }

  assignRole(discordUserId: string, roleId: string): Promise<void> {
    return this.setRole(discordUserId, roleId, "PUT");
  }

  removeRole(discordUserId: string, roleId: string): Promise<void> {
    return this.setRole(discordUserId, roleId, "DELETE");
  }

  // Fetches the role IDs currently held by a guild member. Returns null if
  // the user isn't a member of the guild (404), rather than throwing —
  // unlike assignRole/removeRole, "not a member" is the expected outcome of
  // a plain lookup, not an exceptional case callers need to special-case.
  async getRoleIds(discordUserId: string): Promise<string[] | null> {
    const response = await fetch(`https://discord.com/api/v10/guilds/${this.config.guildId}/members/${discordUserId}`, {
      headers: { Authorization: `Bot ${this.config.botToken}` },
    });

    if (response.status === 404) return null;

    if (!response.ok) {
      const body = await response.text();
      console.error(`[discord-api/members] Failed to fetch member ${discordUserId}: ${response.status} ${body}`);
      throw new Error(`Discord member lookup failed: ${response.status} ${body}`);
    }

    const member = (await response.json()) as { roles: string[] };
    return member.roles;
  }
}
