import { DiscordMembersClient, type DiscordApiConfig } from "./members";

export { DiscordMemberNotFoundError } from "./errors";
export type { DiscordApiConfig } from "./members";

export class DiscordApi {
  public members: DiscordMembersClient;

  constructor(config: DiscordApiConfig) {
    this.members = new DiscordMembersClient(config);
  }
}
