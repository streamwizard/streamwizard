import posthog from "posthog-js";

export interface PostHogConfig {
  key: string;
  host?: string;
}

export function initPostHog({ key, host = "https://eu.i.posthog.com" }: PostHogConfig) {
  posthog.init(key, {
    api_host: "/ingest",
    ui_host: host.replace("i.posthog.com", "posthog.com"),
    defaults: "2026-05-30",
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: "identified_only",
    cookieless_mode: "on_reject",
    disable_session_recording: true,
    disable_surveys: true,
    disable_web_experiments: true,
    disable_conversations: true,
    autocapture: false,
    capture_performance: { web_vitals: true },
    advanced_disable_feature_flags: true,
    advanced_disable_flags: true,
    request_batching: false,
  });
}
