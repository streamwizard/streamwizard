import type { DiscordChannel, DiscordRole } from "@repo/discord-api";
import { channelKind, type ChannelKind } from "./channel-kind";

// Plain, serialisable picker options. Built on the server from the Discord
// REST payloads and handed to the client pickers as props.

export interface PickerOption {
  value: string;
  label: string;
  /** Category name for channels; pickers group by it. */
  group?: string;
  /** Role colour as a CSS hex string, when the role has one. */
  color?: string;
}

export function toChannelOptions(channels: DiscordChannel[], kinds: ChannelKind[]): PickerOption[] {
  const categories = new Map(
    channels.filter((c) => channelKind(c.type) === "category").map((c) => [c.id, c]),
  );
  // Discord's sidebar order: uncategorised channels first, then each category
  // followed by its children.
  const rank = (c: DiscordChannel): [number, number] => {
    if (channelKind(c.type) === "category") return [c.position, -1];
    const parent = c.parent_id ? categories.get(c.parent_id) : undefined;
    return parent ? [parent.position, c.position] : [-1, c.position];
  };
  return channels
    .filter((c) => {
      const kind = channelKind(c.type);
      return kind !== null && kinds.includes(kind);
    })
    .sort((a, b) => {
      const [ap, ao] = rank(a);
      const [bp, bo] = rank(b);
      return ap - bp || ao - bo;
    })
    .map((c) => {
      const isCategory = channelKind(c.type) === "category";
      return {
        value: c.id,
        label: isCategory ? c.name : `#${c.name}`,
        group: isCategory ? "Categories" : (c.parent_id && categories.get(c.parent_id)?.name) || "No category",
      };
    });
}

export function toRoleOptions(roles: DiscordRole[]): PickerOption[] {
  return [...roles]
    .sort((a, b) => b.position - a.position)
    .map((role) => ({
      value: role.id,
      label: role.name,
      color: role.color ? `#${role.color.toString(16).padStart(6, "0")}` : undefined,
    }));
}
