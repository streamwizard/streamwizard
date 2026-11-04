import { z } from "zod";

/** A row id from our own tables (gen_random_uuid). */
export const idSchema = z.uuid();

/** Twitch user, broadcaster, game and video ids are numeric strings. */
export const twitchIdSchema = z.string().regex(/^\d{1,20}$/);

/** Twitch clip ids are slugs: letters, digits, `-` and `_`. */
export const twitchClipIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
