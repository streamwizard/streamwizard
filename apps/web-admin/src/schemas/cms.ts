import { z } from "zod";
import { isGuid } from "@repo/schemas/ids";

// Argument schemas shared by the Content section's server actions.

/** A database id (any 8-4-4-4-12 hex id), failing with `message`: usually
 * "that thing doesn't exist anymore", since a bad id can't name a real row. */
export function cmsIdSchema(message: string) {
  return z.custom<string>(isGuid, message);
}

/** The optimistic lock a post carries (cms_content.lock_version, an int4). */
export const lockVersionSchema = z.number().int().min(0).max(2_147_483_647);

export const contentTypeSchema = z.enum(["blog", "guide"], "Pick blog post or guide.");
