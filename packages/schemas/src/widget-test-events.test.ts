import { describe, expect, it } from "bun:test";
import {
  WIDGET_TEST_EVENTS,
  WIDGET_TEST_EVENT_TYPES,
  buildWidgetTestEvent,
  isWidgetTestEventType,
} from "./widget-test-events";

describe("widget test events", () => {
  // The whole point of centralising the fixtures: if a Twitch payload shape
  // changes and the zod schema is updated, the stale fixture fails here rather
  // than silently lying to widget authors in the editor.
  for (const type of WIDGET_TEST_EVENT_TYPES) {
    it(`${type} builds a payload matching its schema`, () => {
      const { payload } = buildWidgetTestEvent(type);
      const result = WIDGET_TEST_EVENTS[type].schema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  }

  it("builds fresh values per call", () => {
    const a = buildWidgetTestEvent("channel.chat.message");
    const b = buildWidgetTestEvent("channel.chat.message");
    expect(a.payload.message_id).not.toBe(b.payload.message_id);
  });

  it("rejects unknown types", () => {
    expect(isWidgetTestEventType("channel.follow")).toBe(true);
    expect(isWidgetTestEventType("channel.definitely_not_real")).toBe(false);
    expect(isWidgetTestEventType("constructor")).toBe(false);
  });
});
