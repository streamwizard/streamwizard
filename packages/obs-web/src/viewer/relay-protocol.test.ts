import { describe, expect, test } from "bun:test";
import { CLIPBOARD_TEXT_LIMIT, parseRelayMessage } from "./relay-protocol";

const NODE = "https://node-1.streamwizard.org";
const frame = { name: "frame" };
const expected = { origin: NODE, source: frame };
const from = (data: unknown, origin = NODE, source: unknown = frame) => parseRelayMessage({ data, origin, source }, expected);

describe("origin and source checks", () => {
  test("accepts the node's origin from our own frame", () => {
    expect(from({ type: "viewer-expired" })).toEqual({ type: "viewer-expired" });
  });

  test("refuses any other origin", () => {
    expect(from({ type: "viewer-expired" }, "https://evil.example")).toBeNull();
    expect(from({ type: "viewer-expired" }, "https://node-2.streamwizard.org")).toBeNull();
    expect(from({ type: "viewer-expired" }, "null")).toBeNull();
  });

  test("refuses any other window, even on the node's origin", () => {
    expect(from({ type: "viewer-expired" }, NODE, { name: "popup" })).toBeNull();
    expect(from({ type: "viewer-expired" }, NODE, null)).toBeNull();
  });

  test("refuses everything while there is no frame", () => {
    expect(parseRelayMessage({ data: { type: "viewer-expired" }, origin: NODE, source: undefined }, { origin: NODE, source: undefined })).toBeNull();
    expect(parseRelayMessage({ data: { type: "viewer-expired" }, origin: NODE, source: null }, { origin: NODE, source: null })).toBeNull();
  });
});

describe("message schemas", () => {
  test("parses each relay message", () => {
    expect(from({ type: "sw-ready", version: 1 })).toEqual({ type: "sw-ready", version: 1 });
    expect(from({ type: "pipelineStatusUpdate", video: true })).toEqual({ type: "pipelineStatusUpdate", video: true });
    expect(from({ type: "clipboardContentUpdate", text: "hi", truncated: false, secret: false })).toEqual({
      type: "clipboardContentUpdate",
      text: "hi",
      truncated: false,
      secret: false,
    });
    expect(from({ type: "clientRoleUpdate", role: "controller" })).toEqual({ type: "clientRoleUpdate", role: "controller" });
  });

  test("strips unknown keys", () => {
    expect(from({ type: "pipelineStatusUpdate", video: true, html: "<img onerror=x>" })).toEqual({
      type: "pipelineStatusUpdate",
      video: true,
    });
  });

  test("refuses unknown types, wrong field types and oversized text", () => {
    for (const bad of [
      null,
      "viewer-expired",
      { type: "stats", data: {} },
      { type: "sw-ready" },
      { type: "sw-ready", version: "1" },
      { type: "pipelineStatusUpdate", video: "yes" },
      { type: "clipboardContentUpdate", text: 1, truncated: false, secret: false },
      { type: "clipboardContentUpdate", text: "hi" },
      { type: "clipboardContentUpdate", text: "x".repeat(CLIPBOARD_TEXT_LIMIT + 1), truncated: true, secret: false },
      { type: "clientRoleUpdate", role: "" },
      { type: "clientRoleUpdate", role: "x".repeat(33) },
    ]) {
      expect(from(bad)).toBeNull();
    }
  });
});
