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
export { captureEvent, captureEventOnLeave, type AppEvent, type EventMap } from "./events";
export type { ContentProps } from "./event-map";
export { isInternalEmail } from "./internal";
