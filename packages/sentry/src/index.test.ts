import { afterEach, describe, expect, it } from "bun:test";
import type { Log } from "@sentry/core";
import { scrubLog, sentryEnvironment } from "./index";

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
