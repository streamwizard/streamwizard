import { beforeEach, describe, expect, it, mock } from "bun:test";

let status: "granted" | "denied" | "pending" = "pending";
const captures: { event: string; properties: unknown }[] = [];

mock.module("posthog-js", () => ({
  default: {
    get_explicit_consent_status: () => status,
    opt_in_capturing: () => {
      status = "granted";
    },
    // Left "pending" on purpose: this is the browser that blocks storage, so
    // the stored status never changes however the visitor answers.
    opt_out_capturing: () => {},
    capture: (event: string, properties: unknown) => captures.push({ event, properties }),
  },
}));

const browser = new EventTarget();
Object.assign(browser, { location: { href: "https://example.test/dashboard" } });
Object.assign(globalThis, { window: browser, navigator: {} });

const consent = await import("./consent");

describe("consent resolution", () => {
  beforeEach(() => {
    captures.length = 0;
    Object.assign(globalThis, { navigator: {} });
  });

  // Order matters in this file: "resolved this page load" is module state and
  // only ever goes one way, as it does in a browser.
  it("is unresolved while the banner is still unanswered", () => {
    status = "pending";
    expect(consent.isConsentResolved()).toBe(false);
  });

  it("counts Global Privacy Control as an answer", () => {
    Object.assign(globalThis, { navigator: { globalPrivacyControl: true } });
    expect(consent.isConsentResolved()).toBe(true);
  });

  it("counts an answer from an earlier visit", () => {
    status = "denied";
    expect(consent.isConsentResolved()).toBe(true);
    status = "granted";
    expect(consent.isConsentResolved()).toBe(true);
  });

  it("resolves on decline even when storage never records it, and says how it was declined", () => {
    status = "pending";
    let notified = 0;
    const stop = consent.onConsentResolved(() => notified++);
    consent.denyConsent("button");
    stop();

    expect(notified).toBe(1);
    expect(consent.getConsentStatus()).toBe("pending");
    expect(consent.isConsentResolved()).toBe(true);
    expect(captures).toEqual([{ event: "consent_declined", properties: { via: "button" } }]);
  });
});
