import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from "discord.js";
import type { ButtonStyle as PanelButtonStyle, TicketPanel } from "@repo/discord-message";
import type { TicketCategory } from "@repo/supabase/queries/ticket-config";
import type { ExtraActionRow } from "../built-message";
import { TICKET_IDS, ticketId } from "./ids";

// The Create Ticket controls the bot puts under the designed panel. Pure: no
// env, no DB, so it is tested on its own.

const BUTTONS_PER_ROW = 5;

const STYLES: Record<PanelButtonStyle, ButtonStyle> = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
};

function singleButton(panel: TicketPanel): ExtraActionRow[] {
  const button = new ButtonBuilder()
    .setCustomId(TICKET_IDS.create)
    .setLabel(panel.buttonLabel)
    .setStyle(STYLES[panel.buttonStyle]);
  if (panel.buttonEmoji) button.setEmoji(panel.buttonEmoji);
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(button).toJSON()];
}

/**
 * The controls under the panel. A per-category layout needs categories to
 * show; with none (or one, where a menu of one would be silly) it falls back
 * to the single button, which answers "not set up yet" on its own.
 */
export function panelRows(panel: TicketPanel, categories: TicketCategory[]): ExtraActionRow[] {
  if (panel.layout === "button" || categories.length < 2) return singleButton(panel);

  if (panel.layout === "menu") {
    const select = new StringSelectMenuBuilder()
      .setCustomId(TICKET_IDS.pickCategory)
      .setPlaceholder(panel.menuPlaceholder)
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        categories.map((category) => ({
          label: category.name,
          value: category.slug,
          ...(category.description ? { description: category.description } : {}),
          ...(category.emoji ? { emoji: category.emoji } : {}),
        })),
      );
    return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select).toJSON()];
  }

  const rows: ExtraActionRow[] = [];
  for (let i = 0; i < categories.length; i += BUTTONS_PER_ROW) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      categories.slice(i, i + BUTTONS_PER_ROW).map((category) => {
        const button = new ButtonBuilder()
          .setCustomId(ticketId(TICKET_IDS.create, category.slug))
          .setLabel(category.name.slice(0, 80))
          .setStyle(STYLES[panel.buttonStyle]);
        if (category.emoji) button.setEmoji(category.emoji);
        return button;
      }),
    );
    rows.push(row.toJSON());
  }
  return rows;
}

