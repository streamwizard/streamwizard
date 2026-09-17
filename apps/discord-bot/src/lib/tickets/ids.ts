// customId namespace for ticket component interactions. interactionCreate routes
// anything starting with "ticket:" here. Handlers are stateless — they look the
// ticket up by channel id — so buttons keep working across bot restarts.
//
// Shape: "ticket:<action>" or "ticket:<action>:<arg>". The arg is a category
// slug ([a-z0-9_], max 32), so an id always fits Discord's 100 characters.
export const TICKET_IDS = {
  /** Panel button. Bare: ask which category. With a slug: straight to that category's form. */
  create: "ticket:create",
  /** The "which category?" select shown after a bare create. */
  pickCategory: "ticket:pick-category",
  /** The form. Carries the category slug; a bare one is a form opened before categories left the modal. */
  submit: "ticket:submit",
  claim: "ticket:claim",
  close: "ticket:close",
  closeConfirm: "ticket:close-confirm",
  closeCancel: "ticket:close-cancel",
} as const;

// Intro messages posted before the GitHub integration was removed still carry
// this button. It gets a short reply instead of failing silently.
export const RETIRED_GITHUB_ID = "ticket:github";

export const FIELD_IDS = {
  subject: "subject",
  description: "description",
  category: "category",
  product: "product",
} as const;

export const ticketId = (action: string, arg?: string) => (arg ? `${action}:${arg}` : action);

/** Splits "ticket:create:bug" into the action ("ticket:create") and its arg ("bug"). */
export function parseTicketId(customId: string): { action: string; arg: string | null } {
  const [namespace, name, ...rest] = customId.split(":");
  return { action: `${namespace}:${name ?? ""}`, arg: rest.length > 0 ? rest.join(":") : null };
}
