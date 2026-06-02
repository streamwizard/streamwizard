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

export function resetUser() {
  posthog.reset();
}
