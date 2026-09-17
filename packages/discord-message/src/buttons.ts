// What a button can do. A link button opens a web address and needs nothing
// from the bot. An action button runs one of the actions below: the builder
// offers them by key, the bot has a handler for every key
// (apps/discord-bot/src/lib/built-buttons.ts), so an admin can only pick
// something the bot knows how to answer. A new action is a row here plus its
// handler.

export interface ButtonActionDefinition {
  key: string;
  /** Name in the builder's action picker. */
  label: string;
  /** What pressing it does, for the admin. */
  description: string;
  /** What a new button with this action says. */
  defaultLabel: string;
}

export const BUTTON_ACTIONS = [
  {
    key: "link_account",
    label: "Link StreamWizard account",
    description:
      "Answers privately, only the member who pressed it sees it: a link to connect their Discord account to StreamWizard, or a note that they are already linked.",
    defaultLabel: "Check link status",
  },
  {
    key: "create_ticket",
    label: "Open a support ticket",
    description:
      "Starts a ticket the same way the ticket panel does: the member picks a category, fills in the form, and gets a private channel. Tickets have to be set up under Discord, Tickets.",
    defaultLabel: "Create Ticket",
  },
] as const satisfies readonly ButtonActionDefinition[];

export type ButtonActionKey = (typeof BUTTON_ACTIONS)[number]["key"];

export const isButtonActionKey = (key: string): key is ButtonActionKey => BUTTON_ACTIONS.some((action) => action.key === key);

export const getButtonAction = (key: string): ButtonActionDefinition | undefined => BUTTON_ACTIONS.find((action) => action.key === key);

export const BUTTON_STYLES = ["primary", "secondary", "success", "danger"] as const;
export type ButtonStyle = (typeof BUTTON_STYLES)[number];

/** Discord's numbers for button styles. Link buttons are always 5. */
export const API_BUTTON_STYLE: Record<ButtonStyle | "link", number> = { primary: 1, secondary: 2, success: 3, danger: 4, link: 5 };

// custom_id of an action button: "built:<action>:<button id>". The button id
// keeps two buttons with the same action in one message apart, which Discord
// insists on. It survives bot restarts: the handler needs nothing but the id.
const CUSTOM_ID_PREFIX = "built";

export const buttonCustomId = (action: string, buttonId: string): string => `${CUSTOM_ID_PREFIX}:${action}:${buttonId}`;

/** The action a pressed button asks for. Null when the button isn't one of ours. */
export function parseButtonCustomId(customId: string): { action: string } | null {
  const [prefix, action] = customId.split(":");
  return prefix === CUSTOM_ID_PREFIX && action ? { action } : null;
}
