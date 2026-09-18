import { z } from "zod";
import { BUTTON_STYLES } from "./buttons";
import { createMessage } from "./model";
import { DEFAULT_EMBED_COLOR } from "./presets";
import { builtMessageSchema, type BuiltMessage } from "./schema";
import { CORE_VARIABLES, MEMBER_VARIABLES, SERVER_VARIABLES, type VariableDefinition } from "./variables";

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

// The short texts the bot sends around a ticket that aren't a designed
// message: the DM an opener gets when their ticket closes, the reminder in a
// ticket that went quiet, and so on. Stored in discord_ticket_settings.messages
// as a partial object; anything missing falls back to these defaults, so an
// old row keeps working when a key is added.

/** What the closing DM knows: the server, the ticket and why it closed. */
export const TICKET_CLOSE_VARIABLES: VariableDefinition[] = [
  ...SERVER_VARIABLES,
  ...TICKET_VARIABLES,
  { key: "ticket.close_reason", label: "Close reason", sample: "Fixed in the latest update" },
  { key: "ticket.closed_by", label: "Who closed it", sample: "Jochem" },
];

/** What the stale reminder knows: the ticket, its opener and the two timers. */
export const TICKET_STALE_VARIABLES: VariableDefinition[] = [
  ...SERVER_VARIABLES,
  ...MEMBER_VARIABLES,
  ...TICKET_VARIABLES,
  { key: "stale.hours", label: "Hours quiet before the reminder", sample: "48" },
  { key: "close.hours", label: "Hours after the reminder until auto-close", sample: "24" },
];

/** What the close-request line knows: who asked, the ticket, and how long staff have to answer. */
export const TICKET_CLOSE_REQUEST_VARIABLES: VariableDefinition[] = [
  ...SERVER_VARIABLES,
  ...MEMBER_VARIABLES,
  ...TICKET_VARIABLES,
  { key: "request.hours", label: "Hours until the request expires", sample: "24" },
];

/** What the out-of-hours notice knows: the server, the ticket and when staff are next around. */
export const TICKET_HOURS_VARIABLES: VariableDefinition[] = [
  ...SERVER_VARIABLES,
  ...MEMBER_VARIABLES,
  ...TICKET_VARIABLES,
  { key: "hours.next_opening", label: "When staff are next around (Discord timestamp)", sample: "in 14 hours" },
];

export const TICKET_MESSAGE_MAX = 1500;

export const DEFAULT_TICKET_MESSAGES = {
  closeDm:
    "Your ticket [ticket.number] in [server.name] was closed.\n\n**[ticket.subject]**\n[ticket.close_reason]\n\nThe conversation is attached. Open a new ticket any time.",
  staleWarning:
    "[member.mention] it's been quiet in here for [stale.hours] hours. Still need a hand? Reply and this ticket stays open. All sorted? Staff can close it for you.",
  closingSoon:
    "[member.mention] it's been quiet in here for [stale.hours] hours. Still need a hand? Reply and this ticket stays open. If nobody writes in the next [close.hours] hours it closes on its own.",
  autoClosed: "Closed automatically: no reply for [close.hours] hours after the reminder.",
  closeRequest:
    "[member.mention] asked to close this ticket. Staff, is it sorted? Accept to close it or reject to keep it open. Nothing happens if nobody answers within [request.hours] hours.",
  workingHoursNotice: "Heads up: the team is away right now. Someone will pick this up [hours.next_opening].",
} as const;

export type TicketMessageKey = keyof typeof DEFAULT_TICKET_MESSAGES;

/** Which placeholders each text may use; the dashboard rejects any other. */
export const TICKET_MESSAGE_VARIABLES: Record<TicketMessageKey, VariableDefinition[]> = {
  closeDm: TICKET_CLOSE_VARIABLES,
  staleWarning: TICKET_STALE_VARIABLES,
  closingSoon: TICKET_STALE_VARIABLES,
  autoClosed: TICKET_STALE_VARIABLES,
  closeRequest: TICKET_CLOSE_REQUEST_VARIABLES,
  workingHoursNotice: TICKET_HOURS_VARIABLES,
};

const messageText = (key: TicketMessageKey) =>
  z.string().trim().min(1).max(TICKET_MESSAGE_MAX).default(DEFAULT_TICKET_MESSAGES[key]);

export const ticketMessagesSchema = z.object({
  closeDm: messageText("closeDm"),
  staleWarning: messageText("staleWarning"),
  closingSoon: messageText("closingSoon"),
  autoClosed: messageText("autoClosed"),
  closeRequest: messageText("closeRequest"),
  workingHoursNotice: messageText("workingHoursNotice"),
});

export type TicketMessages = z.infer<typeof ticketMessagesSchema>;

/** Always a full set: unknown or broken input falls back to the defaults key by key. */
export function parseTicketMessages(value: unknown): TicketMessages {
  const parsed = ticketMessagesSchema.safeParse(value ?? {});
  if (parsed.success) return parsed.data;
  const partial = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    Object.keys(DEFAULT_TICKET_MESSAGES).map((key) => {
      const one = ticketMessagesSchema.shape[key as TicketMessageKey].safeParse(partial[key]);
      return [key, one.success ? one.data : DEFAULT_TICKET_MESSAGES[key as TicketMessageKey]];
    }),
  ) as TicketMessages;
}
