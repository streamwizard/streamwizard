import { DISCORD_LIMITS, embedCharacterCount } from "./limits";
import { API_BUTTON_STYLE, buttonCustomId } from "./buttons";
import type { BannerElement, BuiltMessage, ButtonsElement, EmbedElement } from "./schema";
import { resolveBannerSource, type BannerSource } from "./themes";

// How a built message becomes Discord messages. A banner is a message of its
// own (an image attachment shows full width, an embed image doesn't); embeds
// that follow each other share one message until Discord's per-message limits
// say otherwise. A row of buttons goes under the embeds right before it, in
// the same message; with no embeds before it, it is a message of its own.
// Messages from one bot posted back to back group under a
// single header, so the channel shows one stack, in order.

/** Plain Discord API embed. discord.js and the REST API both take it as is. */
export interface ApiEmbed {
  title?: string;
  description?: string;
  color: number;
  fields?: { name: string; value: string; inline: boolean }[];
  footer?: { text: string };
}

/** Plain Discord API button and action row. */
export type ApiButton =
  | { type: 2; style: 5; label: string; url: string }
  | { type: 2; style: number; label: string; custom_id: string };

export interface ApiActionRow {
  type: 1;
  components: ApiButton[];
}

export type PlannedMessage =
  | { kind: "banner"; elementId: string; source: BannerSource; altText: string }
  /** `embeds` is empty for buttons that stand alone. */
  | { kind: "embeds"; elementIds: string[]; embeds: ApiEmbed[]; components: ApiActionRow[] };

export function toApiActionRow(row: ButtonsElement): ApiActionRow {
  return {
    type: 1,
    components: row.buttons.map((button) =>
      button.kind === "link"
        ? { type: 2, style: 5, label: button.label, url: button.url }
        : { type: 2, style: API_BUTTON_STYLE[button.style], label: button.label, custom_id: buttonCustomId(button.action, button.id) },
    ),
  };
}

export function toApiEmbed(embed: EmbedElement): ApiEmbed {
  return {
    ...(embed.title.trim() && { title: embed.title }),
    ...(embed.description.trim() && { description: embed.description }),
    color: embed.color,
    ...(embed.fields.length > 0 && {
      fields: embed.fields.map(({ name, value, inline }) => ({ name, value, inline })),
    }),
    ...(embed.footer.trim() && { footer: { text: embed.footer } }),
  };
}

const planBanner = (banner: BannerElement, message: BuiltMessage): PlannedMessage => ({
  kind: "banner",
  elementId: banner.id,
  source: resolveBannerSource(banner, message),
  altText: banner.text.trim(),
});

export function planDiscordMessages(message: BuiltMessage): PlannedMessage[] {
  const planned: PlannedMessage[] = [];
  let group: { elementIds: string[]; embeds: ApiEmbed[]; characters: number } | null = null;

  const flush = () => {
    if (group) planned.push({ kind: "embeds", elementIds: group.elementIds, embeds: group.embeds, components: [] });
    group = null;
  };

  for (const element of message.elements) {
    if (element.type === "banner") {
      flush();
      planned.push(planBanner(element, message));
      continue;
    }
    if (element.type === "buttons") {
      flush();
      // After the flush the last message is the one the element before this belongs to.
      const above = planned.at(-1);
      if (above?.kind === "embeds" && above.components.length < DISCORD_LIMITS.buttonRowsPerMessage) {
        above.elementIds.push(element.id);
        above.components.push(toApiActionRow(element));
      } else {
        planned.push({ kind: "embeds", elementIds: [element.id], embeds: [], components: [toApiActionRow(element)] });
      }
      continue;
    }
    const characters = embedCharacterCount(element);
    if (
      group &&
      (group.embeds.length >= DISCORD_LIMITS.embedsPerMessage ||
        group.characters + characters > DISCORD_LIMITS.embedTotalCharacters)
    ) {
      flush();
    }
    group ??= { elementIds: [], embeds: [], characters: 0 };
    group.elementIds.push(element.id);
    group.embeds.push(toApiEmbed(element));
    group.characters += characters;
  }
  flush();
  return planned;
}
