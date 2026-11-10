import { describe, expect, test } from "bun:test";
import {
  botBroadcastMessageSchema,
  botNodeScopedMessageSchema,
  consumerMessageSchema,
  ingestNodeMessageSchema,
  ingestSessionEndedPayloadSchema,
  ingestSessionRegistrationSchema,
  revokeRequestSchema,
} from "./ws-server";

const ID = "5e550000-0000-4000-8000-000000000001";

describe("bot frames", () => {
  test("a broadcast passes with its payload untouched; extra keys are dropped", () => {
    const payload = { anything: [1, { deep: true }] };
    const parsed = botBroadcastMessageSchema.parse({ userId: ID, type: "channel.follow", payload, source: "old-client" });
    expect(parsed).toEqual({ userId: ID, type: "channel.follow", payload });
  });

  test("a broadcast needs a bounded userId and type", () => {
    for (const bad of [
      { type: "channel.follow", payload: {} },
      { userId: "", type: "channel.follow", payload: {} },
      { userId: ID, type: "", payload: {} },
      { userId: ID, type: "t".repeat(129), payload: {} },
      { userId: "u".repeat(129), type: "channel.follow", payload: {} },
      { userId: 7, type: "channel.follow", payload: {} },
    ]) {
      expect(botBroadcastMessageSchema.safeParse(bad).success).toBe(false);
    }
  });

  test("ping and legacy node_metrics parse; node_metrics needs a node id and numeric rates", () => {
    expect(botNodeScopedMessageSchema.parse({ kind: "ping", ts: 5 })).toEqual({ kind: "ping", ts: 5 });
    const metrics = { kind: "node_metrics", payload: { node_id: "n1", ts: 1, rx_bytes_per_sec: -3, tx_bytes_per_sec: 2, extra: 1 } };
    expect(botNodeScopedMessageSchema.parse(metrics)).toEqual({
      kind: "node_metrics",
      payload: { node_id: "n1", ts: 1, rx_bytes_per_sec: -3, tx_bytes_per_sec: 2 },
    });
    expect(botNodeScopedMessageSchema.safeParse({ kind: "node_metrics", payload: { rx_bytes_per_sec: 1, tx_bytes_per_sec: 2 } }).success).toBe(false);
    expect(botNodeScopedMessageSchema.safeParse({ kind: "node_metrics", payload: { node_id: "n1", rx_bytes_per_sec: "1", tx_bytes_per_sec: 2 } }).success).toBe(false);
    expect(botNodeScopedMessageSchema.safeParse({ kind: "ping" }).success).toBe(false);
    expect(botNodeScopedMessageSchema.safeParse({ kind: "other" }).success).toBe(false);
  });
});

describe("ingest-node frames", () => {
  test("ingest_stats keeps numeric stats and drops identity-named ones", () => {
    const parsed = ingestNodeMessageSchema.parse({
      kind: "ingest_stats",
      session_id: ID,
      protocol: "srtla",
      stats: { kbps: 4500, label: 1, node_id: 2, note: "x" },
      at: "2026-11-04T10:00:00.000Z",
      user_id: "someone-else",
    });
    expect(parsed).toEqual({ kind: "ingest_stats", session_id: ID, protocol: "srtla", stats: { kbps: 4500 }, at: "2026-11-04T10:00:00.000Z" });
  });

  test("node_metrics drops a node id the node put in the payload", () => {
    const parsed = ingestNodeMessageSchema.parse({ kind: "node_metrics", payload: { node_id: "x", rx_bytes_per_sec: 1, tx_bytes_per_sec: 2 } });
    expect(parsed).toEqual({ kind: "node_metrics", payload: { rx_bytes_per_sec: 1, tx_bytes_per_sec: 2 } });
  });

  test("malformed frames are refused", () => {
    for (const bad of [
      { kind: "ingest_stats", session_id: "nope", protocol: "srt", stats: {} },
      { kind: "ingest_stats", session_id: ID, protocol: "webrtc", stats: {} },
      { kind: "ingest_stats", session_id: ID, protocol: "srt", stats: "x" },
      { kind: "ingest_stats", session_id: ID, protocol: "srt" },
      { kind: "node_metrics", payload: { rx_bytes_per_sec: 1e13, tx_bytes_per_sec: 0 } },
      { kind: "ping", ts: "now" },
      { kind: "hello" },
    ]) {
      expect(ingestNodeMessageSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("/internal bodies", () => {
  test("revoke takes a known scope only", () => {
    expect(revokeRequestSchema.parse({ userId: ID, scope: "all", extra: 1 })).toEqual({ userId: ID, scope: "all" });
    expect(revokeRequestSchema.safeParse({ userId: ID, scope: "everything" }).success).toBe(false);
    expect(revokeRequestSchema.safeParse({ scope: "all" }).success).toBe(false);
  });

  test("an ingest session registration needs four UUIDs; label may be null or missing", () => {
    const body = { session_id: ID, user_id: ID, node_id: ID, stream_key_id: ID };
    expect(ingestSessionRegistrationSchema.parse({ ...body, label: "Camera 1", extra: true })).toEqual({ ...body, label: "Camera 1" });
    expect(ingestSessionRegistrationSchema.parse({ ...body, label: null })).toEqual({ ...body, label: null });
    expect(ingestSessionRegistrationSchema.parse(body)).toEqual(body);
    expect(ingestSessionRegistrationSchema.safeParse({ ...body, node_id: "node-1" }).success).toBe(false);
    expect(ingestSessionRegistrationSchema.safeParse({ ...body, label: 5 }).success).toBe(false);
    expect(ingestSessionRegistrationSchema.safeParse({ ...body, label: "x".repeat(1025) }).success).toBe(false);
  });
});

describe("consumer frames", () => {
  test("the envelope parses and keeps the payload for the per-type schema", () => {
    const frame = { userId: ID, type: "streamwizard.ingest_session_ended", payload: { session_id: ID }, ts: 1 };
    expect(consumerMessageSchema.parse(frame)).toEqual(frame);
    expect(consumerMessageSchema.safeParse({ type: "x", payload: {} }).success).toBe(false);
  });

  test("session ended needs a session UUID", () => {
    expect(ingestSessionEndedPayloadSchema.parse({ session_id: ID, node_id: ID, extra: 1 })).toEqual({ session_id: ID, node_id: ID });
    expect(ingestSessionEndedPayloadSchema.safeParse({ session_id: "x" }).success).toBe(false);
    expect(ingestSessionEndedPayloadSchema.safeParse(null).success).toBe(false);
  });
});
