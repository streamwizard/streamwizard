export { PHProvider } from "./provider";
export { PostHogPageView } from "./page-view";
export { initPostHog } from "./init";
export { identifyUser, resetUser } from "./identity";
export {
  CONSENT_GRANTED_EVENT,
  denyConsent,
  getConsentStatus,
  grantConsent,
  hasGlobalPrivacyControl,
  hasGrantedConsent,
  onConsentGranted,
  resetCookieConsent,
  type ConsentStatus,
} from "./consent";
export { captureEvent, type AppEvent } from "./events";
