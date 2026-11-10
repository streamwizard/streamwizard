import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { createApiErrorHandler } from "@/middleware/error-handler";

function setup() {
  const reports: { error: unknown; tag: string; context?: Record<string, unknown> }[] = [];
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("requestId" as never, "req-1" as never);
    c.header("X-Request-ID", "req-1");
    await next();
  });
  // A middleware wrapping next() in try/catch, like the old safeErrorHandler:
  // it must not be what answers, onError is.
  let middlewareCaught = false;
  app.use("*", async (_c, next) => {
    try {
      await next();
    } catch {
      middlewareCaught = true;
    }
  });
  app.onError(createApiErrorHandler((error, tag, context) => reports.push({ error, tag, context })));

  app.get("/boom/:id", () => {
    throw new Error('relation "secret_table" does not exist');
  });
  app.get("/teapot", () => {
    throw new HTTPException(418, { message: "Short and stout" });
  });
  app.get("/async", async () => {
    await Promise.resolve();
    throw new Error("upstream body: {\"token\":\"abc\"}");
  });

  return { app, reports, middlewareCaught: () => middlewareCaught };
}

describe("createApiErrorHandler", () => {
  it("answers an unhandled error with a generic JSON 500 and the request id", async () => {
    const { app, reports, middlewareCaught } = setup();
    const res = await app.request("/boom/123");

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; requestId: string };
    expect(body.error).toBe("Internal server error");
    expect(body.requestId).toBe(res.headers.get("X-Request-ID")!);
    expect(JSON.stringify(body)).not.toContain("secret_table");
    expect(middlewareCaught()).toBe(false);
  });

  it("reports the error with the route pattern, not the raw path", async () => {
    const { app, reports } = setup();
    await app.request("/boom/123");

    expect(reports).toHaveLength(1);
    expect(reports[0]!.tag).toBe("http.unhandled");
    expect((reports[0]!.error as Error).message).toContain("secret_table");
    expect(reports[0]!.context).toMatchObject({ method: "GET", route: "/boom/:id" });
    expect(JSON.stringify(reports[0]!.context)).not.toContain("123");
  });

  it("handles errors thrown after an await too", async () => {
    const { app, reports } = setup();
    const res = await app.request("/async");

    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("token");
    expect(reports).toHaveLength(1);
  });

  it("keeps an HTTPException's own response and does not report it", async () => {
    const { app, reports } = setup();
    const res = await app.request("/teapot");

    expect(res.status).toBe(418);
    expect(await res.text()).toBe("Short and stout");
    expect(reports).toHaveLength(0);
  });
});
