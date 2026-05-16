import { z } from "zod";

// ─── extension.bits_transaction.create ───────────────────────────────────────

export const ExtensionBitsTransactionCreateEventSchema = z.object({
  id: z.string(),
  extension_client_id: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  user_name: z.string(),
  user_login: z.string(),
  user_id: z.string(),
  product: z.object({
    name: z.string(),
    sku: z.string(),
    bits: z.number().int(),
    in_development: z.boolean(),
  }),
});

export type ExtensionBitsTransactionCreateEvent = z.infer<
  typeof ExtensionBitsTransactionCreateEventSchema
>;