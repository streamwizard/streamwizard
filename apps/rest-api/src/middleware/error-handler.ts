import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { reportError } from "@repo/sentry";

type Report = (error: unknown, tag: string, context?: Record<string, unknown>) => void;

/**
 * The answer to anything a route or middleware throws, registered with
 * `app.onError`. Hono catches a thrown error at the layer that threw it and
 * hands it here, so a try/catch middleware around `next()` never sees it.
 *
 * An HTTPException keeps its own response (Hono's 413 from bodyLimit, a
 * deliberate 4xx). Anything else is reported and answered with a generic JSON
 * 500 carrying the request id, never the error's message.
 */
export function createApiErrorHandler(report: Report = reportError): ErrorHandler {
  return (error, c) => {
    if (error instanceof HTTPException) return error.getResponse();

    const requestId = (c.get("requestId") as string | undefined) ?? null;
    // @sentry/hono reports c.error again after this, which Sentry skips for an
    // error object it has already captured. The route pattern goes in the
    // context rather than the raw path, which can carry ids or tokens.
    report(error, "http.unhandled", { requestId, method: c.req.method, route: c.req.routePath });
    return c.json({ error: "Internal server error", requestId }, 500);
  };
}
