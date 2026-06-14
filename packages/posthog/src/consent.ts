import posthog from "posthog-js";

export function resetCookieConsent(): void {
  posthog.clear_opt_in_out_capturing();
  window.location.reload();
}
