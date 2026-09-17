// customId namespace for ticket component interactions. interactionCreate routes
// anything starting with "ticket:" here. Handlers are stateless — they look the
// ticket up by channel id — so buttons keep working across bot restarts.
export const TICKET_IDS = {
  create: "ticket:create",
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
