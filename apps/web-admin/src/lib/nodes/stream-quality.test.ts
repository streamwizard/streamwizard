import { describe, expect, test } from "bun:test";
import type { ObsOutputLatest } from "@repo/metrics";
import { streamQualityTones } from "./stream-quality";

const healthy: ObsOutputLatest = {
  time: "2026-11-10T20:00:00Z",
  streamingActive: true,
  reconnecting: false,
  recordingActive: false,
  kbps: 6000,
  targetKbps: 6000,
  congestion: 0,
  dropPct: 0,
  encodeLagPct: 0,
  renderLagPct: 0,
  renderFps: 60,
  targetFps: 60,
};

describe("streamQualityTones", () => {
  test("no data is neutral everywhere", () => {
    expect(Object.values(streamQualityTones(null)).every((t) => t === "default")).toBe(true);
  });

  test("a clean stream is positive", () => {
    const tones = streamQualityTones(healthy);
    expect(tones.status).toBe("positive");
    expect(tones.bitrate).toBe("positive");
    expect(tones.dropped).toBe("positive");
  });

  test("dropped frames: 1% warns, 5% is danger", () => {
    expect(streamQualityTones({ ...healthy, dropPct: 0.9 }).dropped).toBe("positive");
    expect(streamQualityTones({ ...healthy, dropPct: 1 }).dropped).toBe("warning");
    expect(streamQualityTones({ ...healthy, dropPct: 5 }).dropped).toBe("danger");
    expect(streamQualityTones({ ...healthy, dropPct: 5 }).status).toBe("danger");
  });

  test("congestion: 0.1 warns, 0.3 is danger", () => {
    expect(streamQualityTones({ ...healthy, congestion: 0.1 }).congestion).toBe("warning");
    expect(streamQualityTones({ ...healthy, congestion: 0.3 }).congestion).toBe("danger");
  });

  test("bitrate is read against the encoder target", () => {
    expect(streamQualityTones({ ...healthy, kbps: 4700 }).bitrate).toBe("warning");
    expect(streamQualityTones({ ...healthy, kbps: 2900 }).bitrate).toBe("danger");
    expect(streamQualityTones({ ...healthy, targetKbps: null }).bitrate).toBe("default");
    expect(streamQualityTones({ ...healthy, targetKbps: 0 }).bitrate).toBe("default");
  });

  test("render FPS is read against the target", () => {
    expect(streamQualityTones({ ...healthy, renderFps: 52 }).render).toBe("warning");
    expect(streamQualityTones({ ...healthy, renderFps: 40 }).render).toBe("danger");
  });

  test("render takes the worse of lag and FPS", () => {
    expect(streamQualityTones({ ...healthy, renderLagPct: 6, renderFps: 60 }).render).toBe("danger");
    expect(streamQualityTones({ ...healthy, renderLagPct: 1.5, renderFps: 40 }).render).toBe("danger");
  });

  test("a reconnecting stream is danger even with clean numbers", () => {
    expect(streamQualityTones({ ...healthy, reconnecting: true }).status).toBe("danger");
  });

  test("not streaming: stream tiles stay neutral, render still counts", () => {
    const tones = streamQualityTones({ ...healthy, streamingActive: false, dropPct: 50, renderLagPct: 10 });
    expect(tones.status).toBe("default");
    expect(tones.dropped).toBe("default");
    expect(tones.render).toBe("danger");
  });
});
