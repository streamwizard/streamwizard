import type { Context } from "hono";

export { snowflakeSchema as snowflake } from "@repo/schemas/ids";

/**
 * The request body as JSON, or `fallback` when it is missing or malformed.
 * Routes whose body is optional pass `{}` so an empty request still validates.
 */
export function readJson(c: Context, fallback: unknown = null): Promise<unknown> {
  return c.req.json().catch(() => fallback);
}
