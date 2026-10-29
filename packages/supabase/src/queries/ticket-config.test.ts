import { describe, expect, test } from "bun:test";
import {
  slugifyTicketName,
  ticketFileCounts,
  ticketOptionLabel,
  uniqueTicketSlug,
  TICKET_FIELD_FILES_MAX,
  TICKET_SLUG_MAX,
} from "./ticket-config";

describe("ticket config slugs", () => {
  test("slugify keeps letters and digits, joins the rest with underscores", () => {
    expect(slugifyTicketName("Feature request")).toBe("feature_request");
    expect(slugifyTicketName("  Account & billing!  ")).toBe("account_billing");
    expect(slugifyTicketName("Überlays 2")).toBe("uberlays_2");
  });

  test("slugify returns empty for names with nothing usable", () => {
    expect(slugifyTicketName("🎫")).toBe("");
    expect(slugifyTicketName("---")).toBe("");
  });

  test("slugify fits the column and never ends on an underscore", () => {
    const slug = slugifyTicketName(`${"a".repeat(TICKET_SLUG_MAX - 1)} b`);
    expect(slug.length).toBeLessThanOrEqual(TICKET_SLUG_MAX);
    expect(slug.endsWith("_")).toBe(false);
  });

  test("unique slug counts up past taken ones and falls back for empty names", () => {
    expect(uniqueTicketSlug("Bug", [], "category")).toBe("bug");
    expect(uniqueTicketSlug("Bug", ["bug"], "category")).toBe("bug_2");
    expect(uniqueTicketSlug("Bug", ["bug", "bug_2"], "category")).toBe("bug_3");
    expect(uniqueTicketSlug("🎫", [], "category")).toBe("category");
  });

  test("unique slug stays within the limit when suffixed", () => {
    const long = "a".repeat(TICKET_SLUG_MAX);
    const slug = uniqueTicketSlug(long, [long], "category");
    expect(slug.length).toBe(TICKET_SLUG_MAX);
    expect(slug.endsWith("_2")).toBe(true);
  });
});

describe("ticket option label", () => {
  test("emoji and name, or the slug when the row is gone", () => {
    expect(ticketOptionLabel({ emoji: "🐛", name: "Bug" }, "bug")).toBe("🐛 Bug");
    expect(ticketOptionLabel({ emoji: null, label: "VODs" }, "vods")).toBe("VODs");
    expect(ticketOptionLabel(undefined, "retired")).toBe("retired");
    expect(ticketOptionLabel(undefined, null)).toBe("Not set");
  });
});

describe("ticket file counts", () => {
  const counts = (required: boolean, min_files: number | null, max_files: number | null) =>
    ticketFileCounts({ required, min_files, max_files });

  test("unset means at least one when required and as many as Discord takes", () => {
    expect(counts(true, null, null)).toEqual({ min: 1, max: TICKET_FIELD_FILES_MAX });
  });

  test("an optional field takes zero files, whatever its minimum says", () => {
    expect(counts(false, 3, 5)).toEqual({ min: 0, max: 5 });
  });

  test("values outside Discord's range are pulled back in", () => {
    expect(counts(true, 0, 0)).toEqual({ min: 1, max: 1 });
    expect(counts(true, 40, 40)).toEqual({ min: 10, max: 10 });
    expect(counts(true, 8, 3)).toEqual({ min: 3, max: 3 });
  });
});
