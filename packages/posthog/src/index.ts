export { PHProvider } from "./provider";
export { PostHogPageView } from "./page-view";
export { initPostHog } from "./init";
export { identifyUser, resetUser } from "./identity";
export {
  CONSENT_GRANTED_EVENT,
  CONSENT_RESOLVED_EVENT,
  denyConsent,
  getConsentStatus,
  grantConsent,
  hasGlobalPrivacyControl,
  hasGrantedConsent,
  isConsentResolved,
  markConsentResolved,
  onConsentGranted,
  onConsentResolved,
  resetCookieConsent,
  type ConsentStatus,
} from "./consent";
export { captureEvent, type AppEvent, type EventMap } from "./events";
export { isInternalEmail } from "./internal";
export { useConsentResolved } from "./use-consent-resolved";
