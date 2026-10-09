import posthog from "posthog-js";
import { captureEvent } from "./events";

// Fired on `window` when the visitor accepts analytics. The SDK drops every
// capture — `$identify` included — while consent is pending (nothing is
// queued), and `opt_in_capturing()` then wipes persistence, so anything sent
// before the banner was answered is simply gone. Code that needs to redo work
// after acceptance (identify, Sentry replay) listens for this instead of
// polling the SDK.
export const CONSENT_GRANTED_EVENT = "posthog:consent-granted";

// Fired on `window` once the banner question is settled either way. Things
// that must not sit on top of the banner (the onboarding wizard) wait for it.
export const CONSENT_RESOLVED_EVENT = "posthog:consent-resolved";

export type ConsentStatus = "granted" | "denied" | "pending";

// Settled during this page load, whatever the SDK's stored status says. A
// browser that blocks storage keeps reporting "pending" after an answer, and
// waiting on the stored status alone would then wait forever.
let resolvedThisPageLoad = false;

// Settles the question without recording a choice: for when the banner can't
// be answered at all (an extension hid it). Nobody gets stuck behind a
// question they were never shown.
export function markConsentResolved(): void {
  resolvedThisPageLoad = true;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CONSENT_RESOLVED_EVENT));
}

// True once there is nothing left to ask: answered now, answered on an
// earlier visit, or the browser answered for them (Global Privacy Control).
export function isConsentResolved(): boolean {
  return resolvedThisPageLoad || getConsentStatus() !== "pending" || hasGlobalPrivacyControl();
}

export function onConsentResolved(callback: () => void): () => void {
  window.addEventListener(CONSENT_RESOLVED_EVENT, callback);
  return () => window.removeEventListener(CONSENT_RESOLVED_EVENT, callback);
}

export function getConsentStatus(): ConsentStatus {
  return posthog.get_explicit_consent_status();
}

export function hasGrantedConsent(): boolean {
  return getConsentStatus() === "granted";
}

export function grantConsent(): void {
  posthog.opt_in_capturing();
  // capture_pageview is off and the pre-consent pageview was dropped, so the
  // page the visitor accepted on has to be counted by hand.
  posthog.capture("$pageview", { $current_url: window.location.href });
  window.dispatchEvent(new Event(CONSENT_GRANTED_EVENT));
  markConsentResolved();
}

// With cookieless_mode "on_reject" the SDK handles the rest itself: it
// registers the cookieless distinct id, disables persistence, and fires one
// anonymous $pageview for the current page.
//
// `via` is how the "no" arrived. It goes out as one anonymous, cookieless
// event, so the share of visitors who accept can be worked out at all:
// accepts were counted ($opt_in), declines were not.
export function denyConsent(via: "button" | "gpc"): void {
  posthog.opt_out_capturing();
  captureEvent("consent_declined", { via });
  markConsentResolved();
}

// Global Privacy Control (navigator.globalPrivacyControl) is the browser
// saying "don't track me" before we can ask. posthog-js 1.38x doesn't read
// it, so the banner does: a visitor with it on is treated as having declined,
// with no banner. Not Do-Not-Track — that header is deprecated and browsers
// ship it on by default, so it says nothing about the person.
export function hasGlobalPrivacyControl(): boolean {
  if (typeof navigator === "undefined") return false;
  return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

export function onConsentGranted(callback: () => void): () => void {
  window.addEventListener(CONSENT_GRANTED_EVENT, callback);
  return () => window.removeEventListener(CONSENT_GRANTED_EVENT, callback);
}

export function resetCookieConsent(): void {
  posthog.clear_opt_in_out_capturing();
  window.location.reload();
}
