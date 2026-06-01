import posthog from "posthog-js";

export interface PostHogConfig {
  key: string;
  host?: string;
}

export function initPostHog({ key, host = "https://eu.i.posthog.com" }: PostHogConfig) {
  posthog.init(key, {
    api_host: "/ingest",
    ui_host: host.replace("i.posthog.com", "posthog.com"),
    defaults: "2026-01-30",
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: "identified_only",
    opt_out_capturing_by_default: true, // no tracking until cookie consent
  });
}
