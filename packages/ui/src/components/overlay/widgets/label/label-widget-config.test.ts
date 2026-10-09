import { describe, expect, test } from "bun:test";
import { LABEL_ENTRY_KINDS, getLabelDefinition, type LabelEntry, type ResolvedLabel } from "@repo/schemas";
import { labelWidgetItemConfigSchema } from "../../../../overlay-schemas";
import {
  EVENT_LIST_LABEL_ID,
  LABEL_ENTRY_KIND_LABELS,
  applyLabelEventKinds,
  createDefaultLabelWidgetConfig,
  normalizeLabelWidgetConfig,
} from "./label-widget-config";

const entry = (kind: LabelEntry["kind"], name: string): LabelEntry => ({ kind, name, at: "2026-10-08T12:00:00Z" });
const events: ResolvedLabel = {
  shape: "list",
  items: [entry("follow", "A"), entry("cheer", "B"), entry("sub", "C"), entry("follow", "D"), entry("raid", "E")],
};
const eventList = getLabelDefinition(EVENT_LIST_LABEL_ID);

describe("event list filter", () => {
  test("the event list label exists, and every kind has a name in the filter", () => {
    expect(eventList.id).toBe(EVENT_LIST_LABEL_ID);
    expect(Object.keys(LABEL_ENTRY_KIND_LABELS).sort()).toEqual([...LABEL_ENTRY_KINDS].sort());
  });

  test("a new label shows every kind of event", () => {
    const cfg = createDefaultLabelWidgetConfig();
    expect(cfg.eventKinds).toEqual([...LABEL_ENTRY_KINDS]);
    expect(applyLabelEventKinds(events, eventList, cfg)).toBe(events);
  });

  test("only the picked kinds stay, newest first as before", () => {
    const filtered = applyLabelEventKinds(events, eventList, { eventKinds: ["follow", "raid"] });
    expect(filtered.shape).toBe("list");
    expect((filtered as Extract<ResolvedLabel, { shape: "list" }>).items.map((e) => e.name)).toEqual(["A", "D", "E"]);
  });

  test("nothing picked shows nothing", () => {
    const filtered = applyLabelEventKinds(events, eventList, { eventKinds: [] });
    expect((filtered as Extract<ResolvedLabel, { shape: "list" }>).items).toEqual([]);
  });

  test("other labels are never filtered", () => {
    const latestFollower = getLabelDefinition("latest_follower");
    const resolved: ResolvedLabel = { shape: "entry", entry: entry("follow", "A") };
    expect(applyLabelEventKinds(resolved, latestFollower, { eventKinds: [] })).toBe(resolved);
  });
});

describe("normalizeLabelWidgetConfig eventKinds", () => {
  test("a row from before the filter shows everything", () => {
    expect(normalizeLabelWidgetConfig({ labelId: EVENT_LIST_LABEL_ID }).eventKinds).toEqual([...LABEL_ENTRY_KINDS]);
  });

  test("a stored list keeps only real kinds, without repeats, in catalog order", () => {
    const cfg = normalizeLabelWidgetConfig({ eventKinds: ["raid", "nope", "follow", "raid", 7] });
    expect(cfg.eventKinds).toEqual(["follow", "raid"]);
  });

  test("an empty list stays empty", () => {
    expect(normalizeLabelWidgetConfig({ eventKinds: [] }).eventKinds).toEqual([]);
  });

  test("the schema fills in every kind for an old row and accepts a short list", () => {
    expect(labelWidgetItemConfigSchema.parse({}).eventKinds).toEqual([...LABEL_ENTRY_KINDS]);
    expect(labelWidgetItemConfigSchema.parse({ eventKinds: ["cheer"] }).eventKinds).toEqual(["cheer"]);
    expect(labelWidgetItemConfigSchema.safeParse({ eventKinds: ["nope"] }).success).toBe(false);
  });
});
