import { DiscordGuildsClient } from "./guilds";
import { DiscordMembersClient, type DiscordApiConfig } from "./members";

export { DiscordMemberNotFoundError } from "./errors";
export type { DiscordApiConfig } from "./members";
export {
  sendDiscordDirectMessage,
  type DiscordMessagePayload,
  type DiscordEmbed,
  type DiscordLinkButton,
} from "./dm";
export { sendDiscordChannelMessage, DiscordRateLimitError } from "./channel";
export {
  DiscordChannelType,
  DiscordNotFoundError,
  type DiscordGuild,
  type DiscordMember,
  type DiscordMessage,
  type DiscordUser,
  type DiscordChannel,
  type DiscordRole,
  type DiscordApplicationCommand,
} from "./guilds";

export class DiscordApi {
  public members: DiscordMembersClient;
  public guilds: DiscordGuildsClient;

  constructor(config: DiscordApiConfig) {
    this.members = new DiscordMembersClient(config);
    this.guilds = new DiscordGuildsClient(config);
  }
}
