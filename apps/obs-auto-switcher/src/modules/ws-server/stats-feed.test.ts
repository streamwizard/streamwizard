import { describe, expect, test } from "bun:test";
import { parseConsumerFrame } from "./stats-feed";

const USER = "0e0e0000-0000-4000-8000-000000000001";
const SESSION = "5e550000-0000-4000-8000-000000000001";
const frame = (type: string, payload: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ userId: USER, type, payload, ts: 1, ...extra });

describe("consumer feed frames", () => {
  test("ingest stats parse and keep the stats fields", () => {
    const parsed = parseConsumerFrame(frame("streamwizard.ingest_stats", { session_id: SESSION, protocol: "srt", kbps: 4500, rtt_ms: 30 }));
    expect(parsed).toEqual({
      ok: true,
      event: { type: "streamwizard.ingest_stats", userId: USER, payload: { session_id: SESSION, protocol: "srt", kbps: 4500, rtt_ms: 30 } },
    });
  });

  test("a config push keeps only the user id; extra envelope keys are dropped", () => {
    const parsed = parseConsumerFrame(frame("streamwizard.auto_switcher_config", { user_id: USER, enabled: true }, { extra: 1 }));
    expect(parsed).toEqual({ ok: true, event: { type: "streamwizard.auto_switcher_config", userId: USER, payload: { user_id: USER } } });
  });

  test("session ended needs a session UUID", () => {
    expect(parseConsumerFrame(frame("streamwizard.ingest_session_ended", { session_id: SESSION }))).toEqual({
      ok: true,
      event: { type: "streamwizard.ingest_session_ended", userId: USER, payload: { session_id: SESSION } },
    });
    expect(parseConsumerFrame(frame("streamwizard.ingest_session_ended", { session_id: 7 }))).toEqual({
      ok: false,
      reason: "streamwizard.ingest_session_ended",
    });
  });

  test("malformed frames are refused before any handler sees them", () => {
    expect(parseConsumerFrame("{nope")).toEqual({ ok: false, reason: "invalid_json" });
    expect(parseConsumerFrame(JSON.stringify({ type: "streamwizard.ingest_stats", payload: {} }))).toEqual({ ok: false, reason: "invalid_envelope" });
    expect(parseConsumerFrame(frame("streamwizard.ingest_stats", { session_id: SESSION, protocol: "webrtc" }))).toEqual({
      ok: false,
      reason: "streamwizard.ingest_stats",
    });
    expect(parseConsumerFrame(frame("streamwizard.ingest_stats", { protocol: "srt", kbps: "fast" }))).toEqual({
      ok: false,
      reason: "streamwizard.ingest_stats",
    });
    expect(parseConsumerFrame(frame("streamwizard.auto_switcher_config", { user_id: "someone" })).ok).toBe(false);
  });

  test("other event types are valid but not handled", () => {
    expect(parseConsumerFrame(frame("channel.follow", {}))).toEqual({ ok: true, event: null });
  });
});
