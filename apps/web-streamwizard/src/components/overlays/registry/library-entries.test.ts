import { expect, test } from "bun:test";
import { Tag, ListOrdered, Type } from "lucide-react";
import { buildLibraryEntries } from "./overlay-widget-registry";
import { filterLibraryWidgets } from "../editor/widget-search";

const definitions = [
  { type: "text_widget" as const, icon: Type, category: "layout" as const, library: { title: "Text" } },
  {
    type: "label_widget" as const,
    icon: Tag,
    category: "labels" as const,
    library: { title: "Label", description: "Latest follower and more" },
    libraryPresets: [
      {
        id: "label_widget:event_list",
        icon: ListOrdered,
        title: "Event list",
        description: "A running feed of follows and subs",
        createRootItems: () => [],
      },
    ],
  },
];

test("a preset gets its own card, right after its widget", () => {
  const entries = buildLibraryEntries(definitions);
  expect(entries.map((e) => e.key)).toEqual(["text_widget", "label_widget", "label_widget:event_list"]);
});

test("a preset card adds its parent widget and inherits its category", () => {
  const preset = buildLibraryEntries(definitions).find((e) => e.presetId)!;
  expect(preset.type).toBe("label_widget");
  expect(preset.presetId).toBe("label_widget:event_list");
  expect(preset.category).toBe("labels");
  expect(preset.icon).toBe(ListOrdered);
});

test("a plain widget card carries no preset", () => {
  const [text] = buildLibraryEntries(definitions);
  expect(text!.presetId).toBeUndefined();
  expect(text!.library.title).toBe("Text");
});

test("searching the library finds the preset by its own name", () => {
  const found = filterLibraryWidgets(buildLibraryEntries(definitions), "event list");
  expect(found.map((e) => e.key)).toEqual(["label_widget:event_list"]);
});
