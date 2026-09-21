import { afterEach, describe, expect, it } from "bun:test";
import type { Event, Log } from "@sentry/core";
import { createErrorLimiter, errorLimitKey, scrubLog, sentryEnvironment } from "./index";

describe("scrubLog", () => {
  it("drops stale server action noise from overlays left open across a deploy", () => {
    const log: Log = {
      level: "error",
      message: 'Failed to find Server Action "78747441349c". This request might be from an older or newer deployment.',
    };
    expect(scrubLog(log)).toBeNull();
  });

  it("redacts tokens in the message and in string attributes", () => {
    const log: Log = {
      level: "warn",
      message: "refresh failed access_token=abc123",
      attributes: {
        "sentry.message.parameter.0": "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig",
        "sentry.origin": "auto.console.logging",
        count: 3,
      },
    };
    const scrubbed = scrubLog(log);
    expect(scrubbed?.message).toBe("refresh failed [REDACTED]");
    expect(scrubbed?.attributes?.["sentry.message.parameter.0"]).toBe("[REDACTED]");
    expect(scrubbed?.attributes?.["sentry.origin"]).toBe("auto.console.logging");
    expect(scrubbed?.attributes?.count).toBe(3);
  });
});

describe("sentryEnvironment", () => {
  const saved = { APP_ENV: process.env.APP_ENV, NODE_ENV: process.env.NODE_ENV };
  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("uses NODE_ENV from Doppler", () => {
    delete process.env.APP_ENV;
    process.env.NODE_ENV = "staging";
    expect(sentryEnvironment()).toBe("staging");
  });

  it("prefers the APP_ENV a Next.js build captured over the runtime NODE_ENV", () => {
    // Next's standalone server forces NODE_ENV=production on a staging box.
    process.env.APP_ENV = "staging";
    process.env.NODE_ENV = "production";
    expect(sentryEnvironment()).toBe("staging");
  });

  it("refuses to run with a missing or unknown environment", () => {
    process.env.APP_ENV = "";
    delete process.env.NODE_ENV;
    expect(() => sentryEnvironment()).toThrow("got nothing");
    process.env.NODE_ENV = "prod";
    expect(() => sentryEnvironment()).toThrow('got "prod"');
  });
});

function errorEvent(type: string, value: string): Event {
  return { exception: { values: [{ type, value }] } };
}

describe("createErrorLimiter", () => {
  const DAY = 24 * 60 * 60_000;

  function limiter(perKey: number, total: number) {
    let t = 0;
    const allow = createErrorLimiter({ perKey, total, windowMs: DAY, now: () => t });
    return { allow, advance: (ms: number) => (t += ms) };
  }

  it("lets the same error through perKey times a window, then drops it until the window resets", () => {
    const { allow, advance } = limiter(3, 100);
    const collision = errorEvent("HttpError", "last: schema collision: cannot group float and integer types together");
    expect([1, 2, 3, 4, 5].map(() => allow(collision))).toEqual([true, true, true, false, false]);
    advance(DAY);
    expect(allow(collision)).toBe(true);
  });

  it("treats errors that only differ by ids and numbers as the same error", () => {
    const { allow } = limiter(1, 100);
    expect(allow(errorEvent("Error", "clip 123 failed for 5f1c2a3b-0000-4000-8000-123456789abc"))).toBe(true);
    expect(allow(errorEvent("Error", "clip 456 failed for 9e8d7c6b-1111-4111-8111-abcdefabcdef"))).toBe(false);
    expect(allow(errorEvent("TypeError", "clip 456 failed"))).toBe(true);
  });

  it("caps all errors together, so many different errors can't flood either", () => {
    const { allow } = limiter(10, 5);
    const results = Array.from({ length: 7 }, (_, i) => allow(errorEvent("Error", `distinct failure ${"x".repeat(i)}`)));
    expect(results).toEqual([true, true, true, true, true, false, false]);
  });

  it("keys message-only events on the message", () => {
    expect(errorLimitKey({ message: "Supabase returned 503 for query 42" })).toBe("Supabase returned <n> for query <n>");
  });
});
