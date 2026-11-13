import { describe, expect, test } from "bun:test";
import { discordRoleNoticeSchema, minecraftNameSchema, smpWaitlistSchema, toSmpStreamLanguage } from "./smp";

const valid = { minecraftUsername: "Steve_01", averageViewers: 12, streamLanguage: "nl", streamFrequency: "weekly" } as const;

describe("minecraftNameSchema", () => {
  for (const name of ["abc", "Steve_01", "A234567890123456", "___"]) {
    test(`accepts ${name}`, () => {
      expect(minecraftNameSchema.safeParse({ minecraftUsername: name }).success).toBe(true);
    });
  }

  for (const name of ["", "ab", "A2345678901234567", "has space", "dash-ed", "émile", "name!", 42, null, undefined]) {
    test(`refuses ${JSON.stringify(name)}`, () => {
      expect(minecraftNameSchema.safeParse({ minecraftUsername: name }).success).toBe(false);
    });
  }

  test("trims the spaces a paste brings along", () => {
    expect(minecraftNameSchema.parse({ minecraftUsername: "  Steve_01 " })).toEqual({ minecraftUsername: "Steve_01" });
  });
});

describe("smpWaitlistSchema", () => {
  test("accepts a complete answer", () => {
    expect(smpWaitlistSchema.safeParse(valid).success).toBe(true);
  });

  test("drops fields the form does not have, such as a status", () => {
    const parsed = smpWaitlistSchema.parse({ ...valid, status: "accepted", minecraftUuid: "x" });
    expect(parsed).toEqual(valid);
  });

  for (const [field, value] of [
    ["averageViewers", -1],
    ["averageViewers", 1.5],
    ["averageViewers", Number.NaN],
    ["averageViewers", "12"],
    ["averageViewers", 1_000_001],
    ["streamLanguage", "klingon"],
    ["streamLanguage", ""],
    ["streamFrequency", "sometimes"],
  ] as const) {
    test(`refuses ${field} = ${JSON.stringify(value)}`, () => {
      expect(smpWaitlistSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
    });
  }

  test("says what is wrong in words a person can use", () => {
    const result = smpWaitlistSchema.safeParse({ ...valid, averageViewers: Number.NaN });
    expect(result.error?.issues[0]?.message).toBe("Enter your average viewers as a number.");
  });
});

describe("toSmpStreamLanguage", () => {
  test("keeps a Twitch language we list", () => {
    expect(toSmpStreamLanguage("nl")).toBe("nl");
    expect(toSmpStreamLanguage("other")).toBe("other");
  });

  test("leaves the field empty for one we do not", () => {
    expect(toSmpStreamLanguage("zh-hk")).toBeNull();
    expect(toSmpStreamLanguage("toString")).toBeNull();
    expect(toSmpStreamLanguage(null)).toBeNull();
  });
});

describe("discordRoleNoticeSchema", () => {
  test("only knows the two values the callback sets", () => {
    expect(discordRoleNoticeSchema.safeParse("failed").success).toBe(true);
    expect(discordRoleNoticeSchema.safeParse("pending_membership").success).toBe(true);
    expect(discordRoleNoticeSchema.safeParse("<script>").success).toBe(false);
  });
});
