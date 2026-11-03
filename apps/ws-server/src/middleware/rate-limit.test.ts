import { expect, setSystemTime, test } from "bun:test";
import { isRateLimited } from "./rate-limit";

test("fixed window: 20 allowed, 21st blocked, separate per role, resets after 60s", () => {
  setSystemTime(new Date(1_000_000));
  const results = Array.from({ length: 21 }, () => isRateLimited("subscriber", "1.2.3.4"));
  expect(results.slice(0, 20).every((r) => r === false)).toBe(true);
  expect(results[20]).toBe(true);
  expect(isRateLimited("publisher", "1.2.3.4")).toBe(false);

  setSystemTime(new Date(1_000_000 + 59_999));
  expect(isRateLimited("subscriber", "1.2.3.4")).toBe(true);

  setSystemTime(new Date(1_000_000 + 60_000));
  expect(isRateLimited("subscriber", "1.2.3.4")).toBe(false);
  setSystemTime();
});
