import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { createHmac, randomUUID } from "crypto";
import { type Context, Hono } from "hono";

const SECRET = "test-webhook-secret";

mock.module("../lib/env", () => ({ env: { TWITCH_WEBHOOK_SECRET: SECRET } }));

/** Every request that makes it past the middleware, with the type it was routed as. */
let dispatched: string[] = [];
/** Status the handler answers with; 500 simulates a failed delivery. */
let handlerStatus: 204 | 500 = 204;

let app: Hono;

beforeAll(async () => {
  const { twitchEventSubVerification } = await import("./twitch-eventsub");
  app = new Hono();
  app.post("/eventsub", twitchEventSubVerification(), (c: Context) => {
    dispatched.push(c.get("twitchMessageType"));
    return c.body(null, handlerStatus);
  });
});

beforeEach(() => {
  dispatched = [];
  handlerStatus = 204;
});

const notificationBody = JSON.stringify({
  subscription: { id: "sub-1", type: "stream.online", version: "1", status: "enabled", condition: {} },
  event: { broadcaster_user_id: "123" },
});

const verificationBody = JSON.stringify({
  subscription: { id: "sub-1", type: "stream.online", version: "1", status: "webhook_callback_verification_pending", condition: {} },
  challenge: "challenge-value",
});

const revocationBody = JSON.stringify({
  subscription: { id: "sub-1", type: "stream.online", version: "1", status: "authorization_revoked", condition: {} },
});

function signed(opts: { body?: string; type?: string; id?: string; timestamp?: string } = {}) {
  const body = opts.body ?? notificationBody;
  const id = opts.id ?? randomUUID();
  const timestamp = opts.timestamp ?? new Date().toISOString();
  const signature = "sha256=" + createHmac("sha256", SECRET).update(id + timestamp + body).digest("hex");
  return {
    method: "POST",
    body,
    headers: {
      "Twitch-Eventsub-Message-Id": id,
      "Twitch-Eventsub-Message-Timestamp": timestamp,
      "Twitch-Eventsub-Message-Signature": signature,
      "Twitch-Eventsub-Message-Type": opts.type ?? "notification",
    },
  };
}

describe("twitchEventSubVerification", () => {
  it("lets a fresh, correctly signed notification through", async () => {
    const res = await app.request("/eventsub", signed());
    expect(res.status).toBe(204);
    expect(dispatched).toEqual(["notification"]);
  });

  it("lets fresh verification and revocation messages through", async () => {
    expect((await app.request("/eventsub", signed({ body: verificationBody, type: "webhook_callback_verification" }))).status).toBe(204);
    expect((await app.request("/eventsub", signed({ body: revocationBody, type: "revocation" }))).status).toBe(204);
    expect(dispatched).toEqual(["webhook_callback_verification", "revocation"]);
  });

  it("acknowledges a replayed message id with 204 but dispatches it only once", async () => {
    const req = signed();
    await app.request("/eventsub", req);
    const replay = await app.request("/eventsub", req);
    expect(replay.status).toBe(204);
    expect(dispatched).toHaveLength(1);
  });

  it("lets a retry through when the first attempt failed", async () => {
    const req = signed();
    handlerStatus = 500;
    await app.request("/eventsub", req);
    handlerStatus = 204;
    await app.request("/eventsub", req);
    expect(dispatched).toHaveLength(2);
  });

  it("does not dedupe verification, so a retry still gets the challenge", async () => {
    const req = signed({ body: verificationBody, type: "webhook_callback_verification" });
    await app.request("/eventsub", req);
    await app.request("/eventsub", req);
    expect(dispatched).toHaveLength(2);
  });

  it("rejects a message older than 10 minutes", async () => {
    const old = new Date(Date.now() - 11 * 60_000).toISOString();
    const res = await app.request("/eventsub", signed({ timestamp: old }));
    expect(res.status).toBe(403);
    expect(dispatched).toHaveLength(0);
  });

  it("rejects a timestamp more than 10 minutes in the future", async () => {
    const future = new Date(Date.now() + 11 * 60_000).toISOString();
    expect((await app.request("/eventsub", signed({ timestamp: future }))).status).toBe(403);
    expect(dispatched).toHaveLength(0);
  });

  it("accepts Twitch's nanosecond timestamps", async () => {
    const ts = new Date().toISOString().replace(/\.(\d{3})Z$/, ".$1234567Z");
    expect((await app.request("/eventsub", signed({ timestamp: ts }))).status).toBe(204);
  });

  it("rejects a message type header that does not match the signed body", async () => {
    expect((await app.request("/eventsub", signed({ type: "revocation" }))).status).toBe(400);
    expect((await app.request("/eventsub", signed({ type: "webhook_callback_verification" }))).status).toBe(400);
    expect((await app.request("/eventsub", signed({ body: revocationBody, type: "notification" }))).status).toBe(400);
    expect((await app.request("/eventsub", signed({ type: "something_else" }))).status).toBe(400);
    expect(dispatched).toHaveLength(0);
  });

  it("rejects a bad signature", async () => {
    const req = signed();
    req.headers["Twitch-Eventsub-Message-Signature"] = "sha256=" + "0".repeat(64);
    expect((await app.request("/eventsub", req)).status).toBe(403);
    expect(dispatched).toHaveLength(0);
  });
});
