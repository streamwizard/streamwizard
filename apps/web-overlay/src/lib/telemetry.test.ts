import { describe, expect, it } from "bun:test";
import { parseBeacon } from "./telemetry";

describe("parseBeacon", () => {
  it("accepts a load beacon and derives what it can itself", () => {
    const beacon = parseBeacon({
      kind: "load",
      client: "obs",
      render_mode: "obs",
      widget_types: ["alert_widget", "custom_widget", "alert_widget"],
      widget_count: 3,
      obs_version: "2.24.4",
    });
    expect(beacon).toEqual({
      kind: "load",
      properties: {
        render_mode: "obs",
        widget_types: ["alert_widget", "custom_widget"],
        widget_count: 3,
        has_custom_widget: true,
        client: "obs",
        obs_version: "2.24.4",
      },
    });
  });

  it("drops anything in a load beacon that is not a plain identifier", () => {
    const beacon = parseBeacon({
      kind: "load",
      client: "browser",
      render_mode: "<script>",
      widget_types: ["text_widget", 7, "DROP TABLE", "x".repeat(80)],
      widget_count: "many",
      obs_version: "<b>1</b>",
    });
    expect(beacon?.properties).toEqual({
      render_mode: "unknown",
      widget_types: ["text_widget"],
      widget_count: 0,
      has_custom_widget: false,
      client: "browser",
    });
  });

  it("never passes through an overlay or account id from the body", () => {
    const beacon = parseBeacon({ kind: "load", client: "obs", overlay_id: "someone-else", user_id: "someone-else" });
    expect(beacon?.properties).not.toHaveProperty("overlay_id");
    expect(beacon?.properties).not.toHaveProperty("user_id");
  });

  it("clamps heartbeat counters, so one forged beacon cannot invent a million plays", () => {
    const beacon = parseBeacon({
      kind: "heartbeat",
      client: "obs",
      uptime_s: 612.9,
      on_program: true,
      streaming: "yes",
      clips_played: 1_000_000,
      alerts_shown: -4,
    });
    expect(beacon).toEqual({
      kind: "heartbeat",
      properties: {
        uptime_s: 612,
        client: "obs",
        on_program: true,
        streaming: "unknown",
        clips_played: 500,
        alerts_shown: 0,
      },
    });
  });

  it("rejects an unknown kind, an unknown client and non-objects", () => {
    expect(parseBeacon({ kind: "delete", client: "obs" })).toBeNull();
    expect(parseBeacon({ kind: "load", client: "curl" })).toBeNull();
    expect(parseBeacon(["load"])).toBeNull();
    expect(parseBeacon("load")).toBeNull();
    expect(parseBeacon(null)).toBeNull();
  });
});
