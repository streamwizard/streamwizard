import { describe, expect, it } from "bun:test";
import { defaultScheduleTime, fromLocalInputValue, toLocalInputValue } from "./schedule-time";

describe("schedule time field", () => {
  it("round-trips through the datetime-local format", () => {
    const date = new Date(2026, 9, 20, 9, 5);
    expect(toLocalInputValue(date)).toBe("2026-10-20T09:05");
    expect(fromLocalInputValue("2026-10-20T09:05")?.getTime()).toBe(date.getTime());
  });

  it("suggests the top of the hour after next", () => {
    expect(toLocalInputValue(defaultScheduleTime(new Date(2026, 9, 20, 9, 41)))).toBe("2026-10-20T11:00");
  });

  it("refuses empty or garbled values", () => {
    expect(fromLocalInputValue("")).toBeNull();
    expect(fromLocalInputValue("tomorrow")).toBeNull();
  });
});
