import { describe, expect, it } from "bun:test";
import {
  CONTENT_ACTIONS,
  CONTENT_STATUSES,
  MIN_SCHEDULE_LEAD_MS,
  allowedActions,
  transition,
  type ContentAction,
  type ContentStatus,
} from "./status";

const now = new Date("2026-10-14T12:00:00Z");
const inAnHour = new Date(now.getTime() + 60 * 60 * 1000);

// Every allowed move, written out. Anything not listed must be refused.
const ALLOWED: [ContentStatus, ContentAction, ContentStatus][] = [
  ["draft", "publish", "published"],
  ["draft", "schedule", "scheduled"],
  ["scheduled", "publish", "published"],
  ["scheduled", "schedule", "scheduled"],
  ["scheduled", "unschedule", "draft"],
  ["published", "update", "published"],
  ["published", "unpublish", "draft"],
  ["published", "archive", "archived"],
  ["archived", "publish", "published"],
  ["archived", "unarchive", "draft"],
];

describe("transition", () => {
  for (const status of CONTENT_STATUSES) {
    for (const action of CONTENT_ACTIONS) {
      const allowed = ALLOWED.find(([from, act]) => from === status && act === action);
      it(`${status} + ${action} -> ${allowed ? allowed[2] : "refused"}`, () => {
        const result = transition(status, action, { now, publishAt: inAnHour });
        if (allowed) expect(result).toMatchObject({ ok: true, status: allowed[2] });
        else expect(result.ok).toBe(false);
      });
    }
  }

  it("reports whether the post enters or leaves the site", () => {
    expect(transition("draft", "publish", { now })).toEqual({
      ok: true,
      status: "published",
      wasPublic: false,
      isPublic: true,
    });
    expect(transition("published", "update", { now })).toEqual({
      ok: true,
      status: "published",
      wasPublic: true,
      isPublic: true,
    });
    expect(transition("published", "archive", { now })).toEqual({
      ok: true,
      status: "archived",
      wasPublic: true,
      isPublic: false,
    });
    expect(transition("draft", "schedule", { now, publishAt: inAnHour })).toEqual({
      ok: true,
      status: "scheduled",
      wasPublic: false,
      isPublic: false,
    });
  });

  it("needs a schedule time that is far enough ahead but not absurdly far", () => {
    expect(transition("draft", "schedule", { now })).toEqual({ ok: false, error: "Pick a date and time to publish." });
    expect(transition("draft", "schedule", { now, publishAt: new Date("nope") }).ok).toBe(false);
    expect(
      transition("draft", "schedule", { now, publishAt: new Date(now.getTime() + MIN_SCHEDULE_LEAD_MS - 1) }).ok,
    ).toBe(false);
    expect(transition("draft", "schedule", { now, publishAt: new Date(now.getTime() + MIN_SCHEDULE_LEAD_MS) }).ok).toBe(
      true,
    );
    expect(transition("draft", "schedule", { now, publishAt: new Date("2028-01-01T00:00:00Z") }).ok).toBe(false);
  });

  it("explains a refused move", () => {
    expect(transition("draft", "archive", { now })).toEqual({ ok: false, error: "A draft post can't be archived." });
  });
});

describe("allowedActions", () => {
  it("matches the transition table", () => {
    for (const status of CONTENT_STATUSES) {
      const expected = ALLOWED.filter(([from]) => from === status).map(([, action]) => action);
      expect(allowedActions(status).sort()).toEqual(expected.sort());
    }
  });
});
