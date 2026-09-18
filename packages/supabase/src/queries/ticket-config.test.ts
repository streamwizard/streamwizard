import { describe, expect, test } from "bun:test";
import { slugifyTicketName, ticketOptionLabel, uniqueTicketSlug, TICKET_SLUG_MAX } from "./ticket-config";

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
