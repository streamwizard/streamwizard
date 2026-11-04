import { z } from "zod";

/**
 * Id formats shared by every app. Use these instead of a hand-written regex.
 *
 * - `guidSchema` / `isGuid`: any 8-4-4-4-12 hex id. This is what our database
 *   ids and route params need: seed and test rows use ids like
 *   `aaaaaaaa-0000-0000-0000-000000000001` that aren't RFC 4122 UUIDs.
 * - `uuidSchema` / `isUuid`: an RFC 9562 UUID (version 1-8, RFC variant), for
 *   ids we know come from `gen_random_uuid()` or `crypto.randomUUID()`.
 * - `snowflakeSchema`: a Discord id.
 * - `twitchClipIdSchema` / `isTwitchClipId`: a Twitch clip id, a slug of
 *   letters, digits, `-` and `_`.
 */

export const guidSchema = z.guid();
export const uuidSchema = z.uuid();

export const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
export const snowflakeSchema = z.string().regex(SNOWFLAKE_PATTERN);

export const TWITCH_CLIP_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
export const twitchClipIdSchema = z.string().regex(TWITCH_CLIP_ID_PATTERN);

export function isGuid(value: unknown): value is string {
  return guidSchema.safeParse(value).success;
}

export function isUuid(value: unknown): value is string {
  return uuidSchema.safeParse(value).success;
}

export function isSnowflake(value: unknown): value is string {
  return typeof value === "string" && SNOWFLAKE_PATTERN.test(value);
}

export function isTwitchClipId(value: unknown): value is string {
  return typeof value === "string" && TWITCH_CLIP_ID_PATTERN.test(value);
}
