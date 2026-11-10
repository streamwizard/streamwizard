import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { bearerSecret } from "./bearer-secret";

const SECRET = "s3cret-for-the-discord-bot-api";

let reached = 0;
const app = new Hono();
app.use("*", bearerSecret(SECRET));
app.get("/ping", (c) => {
  reached++;
  return c.json({ ok: true });
});

async function call(authorization?: string) {
  reached = 0;
  const res = await app.request("/ping", authorization === undefined ? undefined : { headers: { Authorization: authorization } });
  return { status: res.status, reached };
}

describe("bearerSecret", () => {
  test("lets the right secret through", async () => {
    expect(await call(`Bearer ${SECRET}`)).toEqual({ status: 200, reached: 1 });
  });

  test("ignores whitespace around the secret", async () => {
    expect(await call(`Bearer  ${SECRET} `)).toEqual({ status: 200, reached: 1 });
  });

  test("refuses a missing header", async () => {
    expect(await call()).toEqual({ status: 401, reached: 0 });
  });

  test("refuses a wrong secret", async () => {
    expect(await call("Bearer not-the-secret")).toEqual({ status: 401, reached: 0 });
  });

  test("refuses a prefix or an extension of the secret", async () => {
    expect(await call(`Bearer ${SECRET.slice(0, -1)}`)).toEqual({ status: 401, reached: 0 });
    expect(await call(`Bearer ${SECRET}x`)).toEqual({ status: 401, reached: 0 });
  });

  test("refuses an empty bearer and other schemes", async () => {
    expect(await call("Bearer ")).toEqual({ status: 401, reached: 0 });
    expect(await call(SECRET)).toEqual({ status: 401, reached: 0 });
    expect(await call(`Basic ${SECRET}`)).toEqual({ status: 401, reached: 0 });
  });
});
