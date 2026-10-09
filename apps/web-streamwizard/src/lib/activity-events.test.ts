import { describe, expect, it } from "bun:test";
import { isRelayedEvent, RELAYED_EVENTS } from "./activity-events";

describe("isRelayedEvent", () => {
  it("accepts the listed events only", () => {
    expect(isRelayedEvent("clip_played")).toBe(true);
    expect(isRelayedEvent("account_deleted")).toBe(false);
    expect(isRelayedEvent("login_completed")).toBe(false);
    expect(isRelayedEvent(42)).toBe(false);
  });

  it("does not mistake object internals for events", () => {
    expect(isRelayedEvent("constructor")).toBe(false);
    expect(isRelayedEvent("toString")).toBe(false);
    expect(isRelayedEvent("__proto__")).toBe(false);
  });
});

describe("RELAYED_EVENTS sanitisers", () => {
  it("keep only the properties an event declares", () => {
    expect(
      RELAYED_EVENTS.overlay_url_copied({ overlay_id: "abc-123", location: "card", user_id: "someone-else" }),
    ).toEqual({ overlay_id: "abc-123", location: "card" });
    expect(RELAYED_EVENTS.clip_played()).toEqual({});
  });

  it("refuse values outside the allowed set", () => {
    expect(RELAYED_EVENTS.overlay_url_copied({ overlay_id: "abc", location: "elsewhere" })).toBeNull();
    expect(RELAYED_EVENTS.overlay_url_copied({ overlay_id: "<script>", location: "card" })).toBeNull();
    expect(RELAYED_EVENTS.cloud_obs_started({ location: "moon" })).toBeNull();
    expect(RELAYED_EVENTS.test_alert_fired({ event_type: "channel.follow", mode: "prod" })).toBeNull();
    expect(RELAYED_EVENTS.deck_scene_switched({ held: "yes" })).toBeNull();
  });

  it("accept a well-formed onboarding step and reject a malformed one", () => {
    expect(RELAYED_EVENTS.onboarding_step_completed({ step_id: "sync-clips", step_index: 1, total_steps: 7 })).toEqual({
      step_id: "sync-clips",
      step_index: 1,
      total_steps: 7,
    });
    expect(
      RELAYED_EVENTS.onboarding_step_completed({ step_id: "sync-clips", step_index: -1, total_steps: 7 }),
    ).toBeNull();
    expect(
      RELAYED_EVENTS.onboarding_step_completed({ step_id: "sync-clips", step_index: 1.5, total_steps: 7 }),
    ).toBeNull();
  });

  it("dedupe and bound the filter list", () => {
    expect(RELAYED_EVENTS.clips_filtered({ filters: ["sort", "sort", "game_id", 7, "DROP TABLE"] })).toEqual({
      filters: ["sort", "game_id"],
    });
    expect(RELAYED_EVENTS.clips_filtered({ filters: [] })).toBeNull();
    expect(RELAYED_EVENTS.clips_filtered({ filters: "sort" })).toBeNull();
  });
});
