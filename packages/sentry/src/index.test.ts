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
  const saved = { ...process.env };
  afterEach(() => {
    for (const key of ["SENTRY_ENVIRONMENT", "ALERT_ENV", "NODE_ENV"]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("maps ALERT_ENV=prod to production when SENTRY_ENVIRONMENT is missing", () => {
    process.env.SENTRY_ENVIRONMENT = "";
    process.env.ALERT_ENV = "prod";
    expect(sentryEnvironment()).toBe("production");
  });

  it("prefers SENTRY_ENVIRONMENT and passes other ALERT_ENV values through", () => {
    process.env.SENTRY_ENVIRONMENT = "production";
    process.env.ALERT_ENV = "staging";
    expect(sentryEnvironment()).toBe("production");
    process.env.SENTRY_ENVIRONMENT = "";
    expect(sentryEnvironment()).toBe("staging");
  });
});
