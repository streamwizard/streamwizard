import { z } from "zod";
import { TWITCH_SCOPE_FEATURES } from "@repo/schemas/twitch-scopes";

/** A `?next=` path handed to a sign-in action. safeNextPath() still decides whether it stays on this site. */
export const nextPathSchema = z.string().max(2048).nullish();

export const authorizeTwitchFeatureSchema = z.object({
  feature: z.union([z.enum(TWITCH_SCOPE_FEATURES), z.literal("base")]),
  next: nextPathSchema,
});
