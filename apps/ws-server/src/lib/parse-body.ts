import type { z } from "zod";

/** The request's JSON body parsed with `schema`, or null when it isn't JSON or
 *  doesn't match. Callers answer null with a plain 400. */
export async function parseJsonBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.output<T> | null> {
  const json: unknown = await req.json().catch(() => undefined);
  const parsed = schema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/** The plain 400 for a body or path that didn't parse. Never says why. */
export function badRequest(): Response {
  return new Response("Bad Request", { status: 400 });
}
