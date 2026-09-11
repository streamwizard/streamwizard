import posthog from "posthog-js";

export interface UserProperties {
  email?: string;
  name?: string;
  twitch_id?: string;
  avatar_url?: string;
  [key: string]: unknown;
}

export function identifyUser(id: string, properties?: UserProperties) {
  posthog.identify(id, properties);
}

// Unlinks the PostHog identity on logout. `posthog.reset()` also clears the
// stored consent choice (ConsentManager.reset runs inside it), which would
// re-show the banner after every logout and forget a decline. Snapshot the
// choice and put it back afterwards.
export function resetUser() {
  const consent = posthog.get_explicit_consent_status();
  // Declined visitors run cookieless: no identity or persistence to reset, and
  // re-applying the opt-out would fire a stray anonymous $pageview.
  if (consent === "denied") return;
  posthog.reset();
  if (consent === "granted") posthog.opt_in_capturing({ captureEventName: null });
}
