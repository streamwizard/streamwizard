import { z } from "zod";

// ─── drop.entitlement.grant ──────────────────────────────────────────────────

const DropEntitlementDataSchema = z.object({
  organization_id: z.string(),
  category_id: z.string(),
  category_name: z.string(),
  campaign_id: z.string(),
  user_id: z.string(),
  user_name: z.string(),
  user_login: z.string(),
  entitlement_id: z.string(),
  benefit_id: z.string(),
  created_at: z.string(),
});

/** Note: drop.entitlement.grant uses `events` (array) instead of `event` */
export const DropEntitlementGrantEventSchema = z.array(
  z.object({
    id: z.string(),
    data: DropEntitlementDataSchema,
  }),
);

export type DropEntitlementGrantEvent = z.infer<typeof DropEntitlementGrantEventSchema>;