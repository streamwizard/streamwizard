import { describe, expect, test } from "bun:test";
import { emptyWorkingHours, parseWorkingHours, workingHoursIssues, type WorkingHours } from "@repo/supabase/queries/ticket-hours";
import { discordRelative, isWithinWorkingHours, nextOpening, zonedClock } from "./working-hours";

const amsterdam: WorkingHours = {
  timezone: "Europe/Amsterdam",
  days: {
    mon: [{ start: "09:00", end: "17:00" }],
    tue: [{ start: "09:00", end: "12:00" }, { start: "13:00", end: "17:00" }],
    wed: [{ start: "09:00", end: "17:00" }],
    thu: [{ start: "09:00", end: "17:00" }],
    fri: [{ start: "09:00", end: "17:00" }],
    sat: [],
    sun: [],
  },
};

describe("parseWorkingHours", () => {
  test("empty or broken input gives no hours in UTC", () => {
    expect(parseWorkingHours(null)).toEqual(emptyWorkingHours("UTC"));
    expect(parseWorkingHours({ timezone: "Mars/Olympus", days: "x" })).toEqual(emptyWorkingHours("UTC"));
  });

  test("bad ranges are dropped, good ones sorted and capped at two", () => {
    const parsed = parseWorkingHours({
      timezone: "Europe/Amsterdam",
      days: {
        mon: [
          { start: "13:00", end: "17:00" },
          { start: "09:00", end: "12:00" },
          { start: "18:00", end: "19:00" },
          { start: "17:00", end: "09:00" },
          { start: "9am", end: "5pm" },
        ],
        funday: [{ start: "00:00", end: "24:00" }],
      },
    });
    expect(parsed.timezone).toBe("Europe/Amsterdam");
    expect(parsed.days.mon).toEqual([
      { start: "09:00", end: "12:00" },
      { start: "13:00", end: "17:00" },
    ]);
    expect(parsed.days.tue).toEqual([]);
    expect(workingHoursIssues(parsed)).toEqual([]);
  });

  test("issues name overlaps and reversed ranges", () => {
    const hours = { ...emptyWorkingHours("UTC"), days: { ...emptyWorkingHours().days, mon: [{ start: "09:00", end: "12:00" }, { start: "11:00", end: "10:00" }] } };
    expect(workingHoursIssues(hours)).toEqual(["mon: 11:00–10:00 ends before it starts."]);
    hours.days.mon = [{ start: "09:00", end: "12:00" }, { start: "11:00", end: "13:00" }];
    expect(workingHoursIssues(hours)).toEqual(["mon: ranges overlap."]);
  });
});

describe("working hours in a zone", () => {
  // Thursday 2026-09-17 15:30 in Amsterdam (CEST, UTC+2) is 13:30Z.
  const thursdayAfternoon = new Date("2026-09-17T13:30:00.000Z");

  test("zonedClock reads the wall clock in the zone", () => {
    expect(zonedClock("Europe/Amsterdam", thursdayAfternoon)).toEqual({ day: "thu", minutes: 15 * 60 + 30, year: 2026, month: 9, date: 17 });
    expect(zonedClock("America/Los_Angeles", thursdayAfternoon).minutes).toBe(6 * 60 + 30);
  });

  test("inside and outside the day's ranges, end exclusive", () => {
    expect(isWithinWorkingHours(amsterdam, thursdayAfternoon)).toBe(true);
    expect(isWithinWorkingHours(amsterdam, new Date("2026-09-17T15:00:00.000Z"))).toBe(false); // 17:00 local
    expect(isWithinWorkingHours(amsterdam, new Date("2026-09-17T06:59:00.000Z"))).toBe(false); // 08:59 local
    expect(isWithinWorkingHours(amsterdam, new Date("2026-09-17T07:00:00.000Z"))).toBe(true); // 09:00 local
    // Tuesday lunch break.
    expect(isWithinWorkingHours(amsterdam, new Date("2026-09-15T10:30:00.000Z"))).toBe(false); // 12:30 local
  });

  test("no hours at all means always around", () => {
    expect(isWithinWorkingHours(emptyWorkingHours("UTC"), thursdayAfternoon)).toBe(true);
    expect(nextOpening(emptyWorkingHours("UTC"), thursdayAfternoon)).toBeNull();
  });

  test("nextOpening finds the next range start, skipping the weekend", () => {
    // Thursday afternoon, in hours: next opening is Friday 09:00 local = 07:00Z.
    expect(nextOpening(amsterdam, thursdayAfternoon)?.toISOString()).toBe("2026-09-18T07:00:00.000Z");
    // Friday 18:00 local: Monday 09:00 local.
    expect(nextOpening(amsterdam, new Date("2026-09-18T16:00:00.000Z"))?.toISOString()).toBe("2026-09-21T07:00:00.000Z");
    // Tuesday 12:30 local, in the lunch break: 13:00 local the same day.
    expect(nextOpening(amsterdam, new Date("2026-09-15T10:30:00.000Z"))?.toISOString()).toBe("2026-09-15T11:00:00.000Z");
  });

  test("nextOpening crosses a DST change", () => {
    // Saturday 2026-10-24 12:00Z; Amsterdam leaves DST on Oct 25 03:00. Monday 09:00 local is then 08:00Z.
    expect(nextOpening(amsterdam, new Date("2026-10-24T12:00:00.000Z"))?.toISOString()).toBe("2026-10-26T08:00:00.000Z");
  });

  test("discordRelative renders the R timestamp", () => {
    expect(discordRelative(new Date(1_700_000_000_500))).toBe("<t:1700000000:R>");
  });
});
