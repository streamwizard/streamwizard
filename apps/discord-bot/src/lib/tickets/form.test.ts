import { describe, expect, test } from "bun:test";
import { defaultTicketPanel } from "@repo/discord-message";
import type { TicketCategory, TicketFormField, TicketProduct } from "@repo/supabase/queries/ticket-config";
import { askableFields, buildTicketModal, readTicketForm, storedDescription, type FormReader } from "./form";
import { panelRows } from "./panel-rows";

const category = (patch: Partial<TicketCategory> = {}): TicketCategory => ({
  id: "cat-1",
  guild_id: "1",
  slug: "bug",
  name: "Bug",
  description: "Something is broken",
  emoji: "🐛",
  position: 0,
  enabled: true,
  archived_at: null,
  discord_category_id: null,
  opening_message: null,
  staff_role_ids: [],
  ping_role_ids: [],
  required_role_ids: [],
  member_limit: null,
  total_limit: null,
  cooldown_seconds: 0,
  slowmode_seconds: 0,
  claiming_enabled: true,
  channel_name_template: "ticket-[ticket.number]",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...patch,
});

const field = (id: string, kind: string, patch: Partial<TicketFormField> = {}): TicketFormField => ({
  id,
  category_id: "cat-1",
  kind,
  label: kind,
  placeholder: "",
  style: "short",
  required: true,
  min_length: null,
  max_length: null,
  options: [],
  position: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...patch,
});

const product = (slug: string, label: string): TicketProduct => ({
  id: slug,
  guild_id: "1",
  slug,
  label,
  description: "",
  emoji: null,
  position: 0,
  archived_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

const reader = (values: Record<string, string>): FormReader => ({
  text: (id) => values[id] ?? null,
  select: (id) => values[id] ?? null,
});

const PRODUCTS = [product("cloud_obs", "Cloud OBS"), product("clips", "Clips")];
const OS = field("f-os", "select", {
  label: "Operating system",
  options: [
    { label: "Windows", value: "win" },
    { label: "macOS", value: "mac" },
  ],
});
const FORM = [field("f-subject", "subject"), field("f-desc", "description"), field("f-product", "product"), OS];

describe("ticket form", () => {
  test("a product question needs products and a select needs options", () => {
    const empty = field("f-empty", "select");
    expect(askableFields([...FORM, empty], []).map((f) => f.id)).toEqual(["f-subject", "f-desc", "f-os"]);
    expect(askableFields(FORM, PRODUCTS)).toHaveLength(4);
  });

  test("never more than Discord's five", () => {
    const many = Array.from({ length: 8 }, (_, i) => field(`f-${i}`, "text"));
    expect(askableFields(many, [])).toHaveLength(5);
  });

  test("the modal carries the category in its id and the field ids as inputs", () => {
    const modal = buildTicketModal(category(), FORM, PRODUCTS)?.toJSON();
    expect(modal?.custom_id).toBe("ticket:submit:bug");
    expect(modal?.title).toBe("Bug");
    expect(JSON.stringify(modal)).toContain('"custom_id":"f-os"');
    expect(modal?.components).toHaveLength(4);
  });

  test("a subject is capped so it fits an embed title, whatever the form allows", () => {
    const modal = buildTicketModal(category(), [field("f-subject", "subject", { max_length: 4000 })], [])?.toJSON();
    expect(JSON.stringify(modal)).toContain('"max_length":100');
  });

  test("a category that asks nothing has no modal", () => {
    expect(buildTicketModal(category(), [], PRODUCTS)).toBeNull();
    expect(buildTicketModal(category(), [field("f-product", "product")], [])).toBeNull();
  });

  test("answers land in the right place", () => {
    const result = readTicketForm(
      category(),
      FORM,
      PRODUCTS,
      reader({ "f-subject": "  OBS won't connect ", "f-desc": "It spins forever", "f-product": "cloud_obs", "f-os": "mac" }),
    );
    expect(result).toEqual({
      subject: "OBS won't connect",
      description: "It spins forever",
      product: "cloud_obs",
      // The option's label, not its value: that is what staff read.
      answers: [{ fieldId: "f-os", label: "Operating system", value: "macOS" }],
    });
  });

  test("a product archived while the form was open is dropped", () => {
    const result = readTicketForm(category(), FORM, PRODUCTS, reader({ "f-subject": "x", "f-desc": "y", "f-product": "gone", "f-os": "win" }));
    expect(result).not.toBe("stale");
    expect((result as { product: string | null }).product).toBeNull();
  });

  test("a missing required question means the form changed underneath them", () => {
    expect(readTicketForm(category(), FORM, PRODUCTS, reader({ "f-subject": "x", "f-desc": "y" }))).toBe("stale");
  });

  test("a missing optional question is fine", () => {
    const optional = [field("f-subject", "subject"), field("f-extra", "text", { required: false })];
    expect(readTicketForm(category(), optional, [], reader({ "f-subject": "x" }))).toEqual({
      subject: "x",
      description: "",
      product: null,
      answers: [],
    });
  });

  test("no subject field files under the category name; no description writes the answers out", () => {
    const questions = [field("f-a", "text", { label: "What happened?" }), field("f-b", "text", { label: "Since when?" })];
    const result = readTicketForm(category(), questions, [], reader({ "f-a": "Crash", "f-b": "Today" }));
    expect(result).not.toBe("stale");
    if (result === "stale") return;
    expect(result.subject).toBe("Bug");
    expect(result.description).toBe("");
    expect(storedDescription(result)).toBe("**What happened?**\nCrash\n\n**Since when?**\nToday");
  });
});

describe("ticket panel controls", () => {
  const categories = [category(), category({ id: "cat-2", slug: "feature", name: "Feature", emoji: null })];
  const ids = (rows: ReturnType<typeof panelRows>) =>
    rows.flatMap((row) => row.components.map((c) => ("custom_id" in c ? c.custom_id : null)));

  test("one button asks the bot to ask", () => {
    expect(ids(panelRows(defaultTicketPanel(), categories))).toEqual(["ticket:create"]);
  });

  test("a button per category goes straight to that category", () => {
    const rows = panelRows({ ...defaultTicketPanel(), layout: "buttons" }, categories);
    expect(ids(rows)).toEqual(["ticket:create:bug", "ticket:create:feature"]);
  });

  test("buttons wrap at five a row", () => {
    const seven = Array.from({ length: 7 }, (_, i) => category({ id: `c${i}`, slug: `c${i}`, name: `C${i}` }));
    const rows = panelRows({ ...defaultTicketPanel(), layout: "buttons" }, seven);
    expect(rows.map((row) => row.components.length)).toEqual([5, 2]);
  });

  test("a menu lists the categories under the pick-category id", () => {
    const rows = panelRows({ ...defaultTicketPanel(), layout: "menu" }, categories);
    expect(ids(rows)).toEqual(["ticket:pick-category"]);
    expect(JSON.stringify(rows)).toContain('"value":"feature"');
  });

  test("with fewer than two categories every layout is the single button", () => {
    expect(ids(panelRows({ ...defaultTicketPanel(), layout: "menu" }, [category()]))).toEqual(["ticket:create"]);
    expect(ids(panelRows({ ...defaultTicketPanel(), layout: "buttons" }, []))).toEqual(["ticket:create"]);
  });
});
