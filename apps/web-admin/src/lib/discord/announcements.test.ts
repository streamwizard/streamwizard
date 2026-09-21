import { describe, expect, test } from "bun:test";
import { createAnnouncement } from "@repo/discord-message";
import { announcementStatus, fromLocalInputValue, toLocalInputValue } from "./announcements";

const draft = { ...createAnnouncement(), title: "Hi" };

describe("announcementStatus", () => {
  test("follows the row's own status for everything but posted", () => {
    for (const status of ["draft", "scheduled", "posting", "failed"] as const) {
      expect(announcementStatus({ status, draft, posted: null })).toBe(status);
    }
    expect(announcementStatus({ status: "whatever", draft, posted: null })).toBe("draft");
  });

  test("posted is live only while the draft matches what went out", () => {
    expect(announcementStatus({ status: "posted", draft, posted: draft })).toBe("posted");
    expect(announcementStatus({ status: "posted", draft: { ...draft, title: "Changed" }, posted: draft })).toBe("changed");
    expect(announcementStatus({ status: "posted", draft, posted: null })).toBe("changed");
  });
});

describe("local datetime input values", () => {
  test("round-trips a local wall time", () => {
    const local = "2026-09-22T18:30";
    const iso = fromLocalInputValue(local);
    expect(iso).not.toBeNull();
    expect(toLocalInputValue(iso!)).toBe(local);
  });

  test("uses the local zone, not UTC", () => {
    const d = new Date(2026, 0, 5, 9, 7);
    expect(toLocalInputValue(d)).toBe("2026-01-05T09:07");
  });

  test("garbage is null", () => {
    expect(fromLocalInputValue("")).toBeNull();
    expect(fromLocalInputValue("not a time")).toBeNull();
  });
});
