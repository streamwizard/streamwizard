import { describe, expect, test } from "bun:test";
import vm from "node:vm";
import { buildWidgetSrcdoc } from "./widget-srcdoc";
import type { WidgetFieldSchema } from "./widget-fields";

const FIELDS: WidgetFieldSchema = {
  greeting: { type: "text", label: "Greeting", value: "hi chat" },
  style: {
    type: "group",
    label: "Style",
    fields: { accentColor: { type: "colorpicker", label: "Accent", value: "#9e7aff" } },
  },
};

type Listener = (event: { type: string; detail?: unknown; data?: unknown }) => void;

/**
 * Runs the widget's runtime script (the one that sets up window.StreamWizard
 * and then runs the author's JS) in a bare VM with just enough of a window to
 * boot. Returns the global and a way to post the messages the parent sends.
 */
function boot(js: string, fieldValues: Record<string, unknown> = {}) {
  const srcdoc = buildWidgetSrcdoc("<div></div>", js, "", FIELDS, fieldValues);
  const scripts = [...srcdoc.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? "");
  const runtime = scripts.find((s) => s.includes("window.StreamWizard = {"));
  if (!runtime) throw new Error("runtime script not found in srcdoc");

  const listeners: Record<string, Listener[]> = {};
  const sandbox: Record<string, unknown> = {
    console,
    CustomEvent: class {
      type: string;
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    document: { documentElement: { style: {} }, body: { style: {} } },
    parent: { postMessage() {} },
    addEventListener(type: string, cb: Listener) {
      (listeners[type] ??= []).push(cb);
    },
    dispatchEvent(event: { type: string }) {
      for (const cb of listeners[event.type] ?? []) cb(event);
      return true;
    },
  };
  const context = vm.createContext(sandbox);
  context.window = context;
  vm.runInContext(runtime, context);

  const post = (data: unknown) => {
    for (const cb of listeners.message ?? []) cb({ type: "message", data });
  };
  return { srcdoc, global: context as Record<string, unknown>, post };
}

describe("buildWidgetSrcdoc fieldData", () => {
  test("is a global on the author's first line, defaults merged with overrides", () => {
    const { global } = boot(
      "var firstLine = { greeting: fieldData.greeting, accent: fieldData.accentColor };",
      { greeting: "yo" }
    );
    expect(global.firstLine).toEqual({ greeting: "yo", accent: "#9e7aff" });
    expect((global.StreamWizard as { fieldData: unknown }).fieldData).toEqual({
      greeting: "yo",
      accentColor: "#9e7aff",
    });
  });

  test("follows onWidgetLoad and onFieldsUpdate", () => {
    const { global, post } = boot(`
      var seen = [];
      addEventListener('onWidgetLoad', function (e) { seen.push(['load', e.detail.fieldData.greeting, fieldData.greeting]); });
      addEventListener('onFieldsUpdate', function (e) { seen.push(['update', e.detail.fieldData.greeting, fieldData.greeting]); });
    `);
    post({ type: "onWidgetLoad", payload: { fieldData: { greeting: "loaded" }, channel: { user_id: "1" }, session: {} } });
    post({ type: "swFieldData", fieldData: { greeting: "edited" } });

    expect(global.seen).toEqual([
      ["load", "loaded", "loaded"],
      ["update", "edited", "edited"],
    ]);
    expect((global.StreamWizard as { fieldData: unknown }).fieldData).toEqual({ greeting: "edited" });
  });

  test("an author's own top-level const fieldData still works", () => {
    const { global } = boot("const fieldData = { mine: true }; var read = fieldData.mine;");
    expect(global.read).toBe(true);
  });

  test("an author's var fieldData assigned in onWidgetLoad still works", () => {
    const { global, post } = boot(`
      var fieldData = {};
      var duration = 5;
      addEventListener('onWidgetLoad', function (e) { fieldData = e.detail.fieldData; duration = fieldData.duration; });
    `);
    post({ type: "onWidgetLoad", payload: { fieldData: { duration: 9 }, channel: { user_id: "1" }, session: {} } });
    expect(global.duration).toBe(9);
  });

  test("a value containing </script> cannot end the tag", () => {
    const { srcdoc, global } = boot("var g = fieldData.greeting;", { greeting: "</script><b>hi </b>" });
    expect(srcdoc).not.toContain("</script><b>");
    expect(global.g).toBe("</script><b>hi </b>");
  });
});
