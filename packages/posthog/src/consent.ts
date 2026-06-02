import posthog from "posthog-js";

const CONSENT_KEY = "sw_cookie_consent";

export function resetCookieConsent(): void {
  localStorage.removeItem(CONSENT_KEY);
  posthog.opt_out_capturing();
  window.location.reload();
}
