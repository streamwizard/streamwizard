import { describe, expect, it } from "bun:test";
import { REVIEW_FILTER_STATES, REVIEW_STATES, asReviewState, countComments, nextReviewStates } from "./review";

describe("asReviewState", () => {
  it("takes the states the column allows", () => {
    for (const state of REVIEW_STATES) expect(asReviewState(state)).toBe(state);
  });

  it("falls back to none for anything else", () => {
    expect(asReviewState("published")).toBe("none");
    expect(asReviewState(null)).toBe("none");
    expect(asReviewState(undefined)).toBe("none");
  });
});

describe("nextReviewStates", () => {
  it("leaves out the state it is already in", () => {
    expect(nextReviewStates("approved")).not.toContain("approved");
    expect(nextReviewStates("approved")).toHaveLength(REVIEW_STATES.length - 1);
  });
});

describe("countComments", () => {
  const comment = (parentId: string | null, resolvedAt: string | null) => ({ parentId, resolvedAt });

  it("counts threads, not replies", () => {
    expect(
      countComments([comment(null, null), comment("1", null), comment("1", null), comment(null, null)]),
    ).toEqual({ open: 2, resolved: 0 });
  });

  it("keeps resolved threads apart from open ones", () => {
    expect(countComments([comment(null, null), comment(null, "2026-10-22T10:00:00Z")])).toEqual({
      open: 1,
      resolved: 1,
    });
  });

  it("counts nothing when there is nothing", () => {
    expect(countComments([])).toEqual({ open: 0, resolved: 0 });
  });
});

describe("REVIEW_FILTER_STATES", () => {
  it("leaves out the state most posts are in", () => {
    expect(REVIEW_FILTER_STATES).toEqual(["requested", "changes", "approved"]);
  });
});
