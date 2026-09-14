import type { DiscordChannel, DiscordRole } from "@repo/discord-api";
import { channelKind } from "./channel-kind";

/** id → display label for channels ("#name") and roles ("@name"). */
export function buildNameMap(channels: DiscordChannel[], roles: DiscordRole[]): Map<string, string> {
  return new Map([
    ...channels.map((c): [string, string] => [c.id, channelKind(c.type) === "category" ? c.name : `#${c.name}`]),
    ...roles.map((r): [string, string] => [r.id, `@${r.name}`]),
  ]);
}
