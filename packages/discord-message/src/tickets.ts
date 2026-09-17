import { z } from "zod";
import { BUTTON_STYLES } from "./buttons";
import { createMessage } from "./model";
import { DEFAULT_EMBED_COLOR } from "./presets";
import { builtMessageSchema, type BuiltMessage } from "./schema";
import { CORE_VARIABLES, SERVER_VARIABLES, type VariableDefinition } from "./variables";

// The two ticket messages an admin designs in the builder: the panel members
// open tickets from, and what a new ticket channel opens with. web-admin edits
// them, the bot sends them, and the defaults live here so both agree on what
// "nothing saved yet" looks like.

export const TICKET_VARIABLES: VariableDefinition[] = [
  { key: "ticket.number", label: "Ticket number", sample: "#0042" },
  { key: "ticket.category", label: "Ticket category", sample: "Bug" },
  { key: "ticket.product", label: "Ticket product", sample: "Cloud OBS" },
  { key: "ticket.subject", label: "Ticket subject", sample: "OBS won't connect" },
];

/** The panel is for everyone, so it knows the server and nothing about a member or a ticket. */
export const TICKET_PANEL_VARIABLES: VariableDefinition[] = SERVER_VARIABLES;

/** The opening message knows who opened the ticket and what it is. */
export const TICKET_OPENING_VARIABLES: VariableDefinition[] = [...CORE_VARIABLES, ...TICKET_VARIABLES];

/**
 * How members pick a category from the panel:
 * - button: one button, then the bot asks which category
 * - buttons: a button per category
 * - menu: a select menu listing the categories
 */
export const TICKET_PANEL_LAYOUTS = ["button", "buttons", "menu"] as const;
export type TicketPanelLayout = (typeof TICKET_PANEL_LAYOUTS)[number];

/** Discord's caps for a button label and a select placeholder. */
export const TICKET_BUTTON_LABEL_MAX = 80;
export const TICKET_MENU_PLACEHOLDER_MAX = 150;

export const ticketPanelSchema = z.object({
  message: builtMessageSchema,
  layout: z.enum(TICKET_PANEL_LAYOUTS),
  /** The single button's label. Per-category buttons use the category's name. */
  buttonLabel: z.string().trim().min(1).max(TICKET_BUTTON_LABEL_MAX),
  buttonEmoji: z.string().max(64).nullable(),
  buttonStyle: z.enum(BUTTON_STYLES),
  menuPlaceholder: z.string().trim().min(1).max(TICKET_MENU_PLACEHOLDER_MAX),
});

export type TicketPanel = z.infer<typeof ticketPanelSchema>;

export function defaultTicketPanel(): TicketPanel {
  return {
    message: createMessage([
      {
        type: "embed",
        title: "Need a hand?",
        description:
          "Open a support ticket and our team will help you out. Click the button below to get started — we'll spin up a private channel just for you.",
        color: DEFAULT_EMBED_COLOR,
        fields: [],
        footer: "StreamWizard Support",
      },
    ]),
    layout: "button",
    buttonLabel: "Create Ticket",
    buttonEmoji: "🎫",
    buttonStyle: "primary",
    menuPlaceholder: "Pick a category to open a ticket",
  };
}

/** The stored panel, or the default when nothing (or something unreadable) is stored. */
export function parseTicketPanel(value: unknown): TicketPanel {
  const parsed = ticketPanelSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultTicketPanel();
}

/**
 * What goes above the ticket card in a new ticket channel. Embeds only: it
 * shares one Discord message with the card, and the card's Claim and Close
 * buttons are the only buttons there.
 */
export const TICKET_OPENING_MAX_EMBEDS = 3;

export const ticketOpeningSchema = builtMessageSchema.refine(
  (message) => message.elements.every((element) => element.type === "embed"),
  { message: "The opening message can only hold embeds." },
);

/** Null when nothing usable is stored: the ticket card then stands alone. */
export function parseTicketOpening(value: unknown): BuiltMessage | null {
  const parsed = ticketOpeningSchema.safeParse(value);
  return parsed.success && parsed.data.elements.length > 0 ? parsed.data : null;
}
