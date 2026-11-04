import { describe, expect, test } from "bun:test";
import { parseUpgradeQuery } from "./schemas";

const query = (qs: string) => parseUpgradeQuery(new URL(`http://ws.local/ws?${qs}`));

describe("upgrade query", () => {
  test("role, token and CSV lists parse; empty entries and unknown params are dropped", () => {
    const parsed = query("role=subscriber&token=abc&channels=channel.follow,,%20channel.raid&source=old");
    expect(parsed).toEqual({
      ok: true,
      query: { role: "subscriber", token: "abc", channels: new Set(["channel.follow", "channel.raid"]), types: new Set() },
    });
  });

  test("a missing or unknown role is invalid_role", () => {
    expect(query("token=abc")).toEqual({ ok: false, reason: "invalid_role" });
    expect(query("role=admin")).toEqual({ ok: false, reason: "invalid_role" });
  });

  test("an oversized token or list is invalid_query", () => {
    expect(query(`role=subscriber&token=${"a".repeat(16_385)}`)).toEqual({ ok: false, reason: "invalid_query" });
    expect(query(`role=consumer&types=${Array.from({ length: 201 }, (_, i) => `t${i}`).join(",")}`)).toEqual({
      ok: false,
      reason: "invalid_query",
    });
    expect(query(`role=subscriber&channels=${"c".repeat(129)}`)).toEqual({ ok: false, reason: "invalid_query" });
  });
});
