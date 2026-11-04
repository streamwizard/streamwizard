import { z } from "zod";

// Row ids use guidSchema and Twitch clip ids twitchClipIdSchema, both from
// @repo/schemas/ids.

/** Twitch user, broadcaster, game and video ids are numeric strings. */
export const twitchIdSchema = z.string().regex(/^\d{1,20}$/);
