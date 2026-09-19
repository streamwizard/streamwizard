import posthog from "posthog-js";

// Fired on `window` when the visitor accepts analytics. The SDK drops every
// capture — `$identify` included — while consent is pending (nothing is
// queued), and `opt_in_capturing()` then wipes persistence, so anything sent
// before the banner was answered is simply gone. Code that needs to redo work
// after acceptance (identify, Sentry replay) listens for this instead of
// polling the SDK.
export const CONSENT_GRANTED_EVENT = "posthog:consent-granted";

export type ConsentStatus = "granted" | "denied" | "pending";

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
}

// With cookieless_mode "on_reject" the SDK handles the rest itself: it
// registers the cookieless distinct id, disables persistence, and fires one
// anonymous $pageview for the current page.
export function denyConsent(): void {
  posthog.opt_out_capturing();
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
