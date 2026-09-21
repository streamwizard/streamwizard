import { DiscordGuildsClient } from "./guilds";
import { DiscordMembersClient, type DiscordApiConfig } from "./members";

export { DiscordMemberNotFoundError, DiscordRoleNotFoundError } from "./errors";
export type { DiscordApiConfig } from "./members";
export {
  sendDiscordDirectMessage,
  type DiscordMessagePayload,
  type DiscordEmbed,
  type DiscordLinkButton,
  type DiscordAllowedMentions,
} from "./dm";
export {
  sendDiscordChannelMessage,
  editDiscordChannelMessage,
  DiscordRateLimitError,
  DiscordUnknownMessageError,
} from "./channel";
export {
  DiscordChannelType,
  DiscordNotFoundError,
  type DiscordGuild,
  type DiscordMember,
  type DiscordMessage,
  type DiscordUser,
  type DiscordChannel,
  type DiscordRole,
  type DiscordCreateRoleInput,
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
