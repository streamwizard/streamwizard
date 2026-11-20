import { z } from "zod";

// Input for /api/live/* (the StreamWizard Live phone app, signed in) and the
// session id format the ingest node lookup shares.

/**
 * A session's 64-bit wire id as 16 lowercase hex characters. A string
 * because a JS number can't hold a u64. Never all zero.
 */
export const wireIdSchema = z
  .string()
  .regex(/^[0-9a-f]{16}$/)
  .refine((id) => id !== "0000000000000000");

/** POST /api/live/sessions */
export const createLiveSessionSchema = z.object({
  stream_key: z.string().min(1).max(256),
});
