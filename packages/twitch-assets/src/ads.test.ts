import { describe, expect, test } from "bun:test";
import { adTime, toPublicAdSchedule } from "./ads";

describe("adTime", () => {
  test("RFC3339, unix seconds as a number or a string", () => {
    expect(adTime("2023-08-01T23:08:18+00:00")).toBe("2023-08-01T23:08:18.000Z");
    expect(adTime(1728825458)).toBe("2024-10-13T13:17:38.000Z");
    expect(adTime("1728825458")).toBe("2024-10-13T13:17:38.000Z");
  });

  test("empty values mean none", () => {
    for (const v of ["", 0, "0", null, undefined, "nonsense"]) expect(adTime(v)).toBeNull();
  });
});

describe("toPublicAdSchedule", () => {
  test("numbers from strings, nothing from nothing", () => {
    const s = toPublicAdSchedule({
      next_ad_at: "2023-08-01T23:08:18+00:00",
      last_ad_at: "",
      duration: "60",
      preroll_free_time: "90",
      snooze_count: "1",
      snooze_refresh_at: 0,
    })!;
    expect(s).toEqual({
      next_ad_at: "2023-08-01T23:08:18.000Z",
      last_ad_at: null,
      duration: 60,
      preroll_free_time: 90,
      snooze_count: 1,
      snooze_refresh_at: null,
    });
    expect(toPublicAdSchedule(null)).toBeNull();
  });
});
