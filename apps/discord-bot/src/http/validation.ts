import type { Context } from "hono";
import { z } from "zod";

export const snowflake = z.string().regex(/^\d{17,20}$/);

/**
 * The request body as JSON, or `fallback` when it is missing or malformed.
 * Routes whose body is optional pass `{}` so an empty request still validates.
 */
export function readJson(c: Context, fallback: unknown = null): Promise<unknown> {
  return c.req.json().catch(() => fallback);
}
