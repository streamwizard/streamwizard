import { beforeEach, describe, expect, it, mock } from "bun:test";

let status: "granted" | "denied" | "pending" = "pending";
const captures: { event: string; properties: unknown }[] = [];
let recordingStarts = 0;

mock.module("posthog-js", () => ({
  default: {
    get_explicit_consent_status: () => status,
    opt_in_capturing: () => {
      status = "granted";
    },
    opt_out_capturing: () => {
      status = "denied";
    },
    capture: (event: string, properties: unknown) => captures.push({ event, properties }),
    startSessionRecording: () => {
      recordingStarts++;
    },
    init: () => {},
  },
}));

const browser = new EventTarget();
Object.assign(browser, { location: { href: "https://example.test/dashboard" } });
Object.assign(globalThis, { window: browser, navigator: {} });

const consent = await import("./consent");

describe("consent", () => {
  beforeEach(() => {
    status = "pending";
    captures.length = 0;
    recordingStarts = 0;
  });

  it("a decline starts no recording and is counted once, with how it arrived", () => {
    consent.denyConsent("button");
    expect(recordingStarts).toBe(0);
    expect(captures).toEqual([{ event: "consent_declined", properties: { via: "button" } }]);
  });

  it("tells a banner decline apart from the browser answering for them", () => {
    consent.denyConsent("gpc");
    expect(captures[0]?.properties).toEqual({ via: "gpc" });
  });

  it("an accept starts recording, counts the page it happened on and tells listeners", () => {
    let granted = 0;
    const stop = consent.onConsentGranted(() => granted++);
    consent.grantConsent();
    stop();

    expect(recordingStarts).toBe(1);
    expect(captures).toEqual([{ event: "$pageview", properties: { $current_url: "https://example.test/dashboard" } }]);
    expect(granted).toBe(1);
    expect(consent.hasGrantedConsent()).toBe(true);
  });
});
