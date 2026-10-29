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
function boot(
  js: string,
  fieldValues: Record<string, unknown> = {},
  env: { overlayOrigin?: string; editor?: boolean; fetch?: unknown; posted?: unknown[] } = {}
) {
  const srcdoc = buildWidgetSrcdoc("<div></div>", js, "", FIELDS, fieldValues, env.overlayOrigin, undefined, {
    editor: env.editor,
  });
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
    parent: {
      postMessage(msg: unknown) {
        env.posted?.push(msg);
      },
    },
    fetch: env.fetch,
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
    let stopped = false;
    const event = { type: "message", data, stopImmediatePropagation: () => { stopped = true; } };
    for (const cb of listeners.message ?? []) {
      cb(event);
      if (stopped) break;
    }
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

describe("buildWidgetSrcdoc editor mute", () => {
  class FakeMedia {
    muted = false;
    ended = false;
    play() {
      return Promise.resolve();
    }
  }

  /** Runs just the editor's mute script against fake media elements. */
  function bootMute(domMedia: FakeMedia[]) {
    const srcdoc = buildWidgetSrcdoc("<div></div>", "", "", FIELDS, {}, undefined, undefined, { editor: true });
    const script = [...srcdoc.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
      .map((m) => m[1] ?? "")
      .find((s) => s.includes("swSetMuted"));
    if (!script) throw new Error("mute script not found in srcdoc");

    const messageListeners: Listener[] = [];
    const context = vm.createContext({
      HTMLMediaElement: FakeMedia,
      document: {
        addEventListener() {},
        querySelectorAll: () => domMedia,
      },
      addEventListener(type: string, cb: Listener) {
        if (type === "message") messageListeners.push(cb);
      },
    });
    context.window = context;
    vm.runInContext(script, context);
    return (muted: boolean) => {
      for (const cb of messageListeners) cb({ type: "message", data: { type: "swSetMuted", muted } });
    };
  }

  test("is only installed in editor documents", () => {
    expect(buildWidgetSrcdoc("<div></div>", "", "", FIELDS, {})).not.toContain("swSetMuted");
  });

  test("mutes played sounds and page media, and only unmutes what it muted", () => {
    const inPage = new FakeMedia();
    const authorMuted = new FakeMedia();
    authorMuted.muted = true;
    const setMuted = bootMute([inPage, authorMuted]);

    const sound = new FakeMedia();
    sound.play();
    setMuted(true);
    expect([sound.muted, inPage.muted, authorMuted.muted]).toEqual([true, true, true]);

    // A sound started while muted starts silent.
    const later = new FakeMedia();
    later.play();
    expect(later.muted).toBe(true);

    setMuted(false);
    expect([sound.muted, inPage.muted, later.muted]).toEqual([false, false, false]);
    expect(authorMuted.muted).toBe(true);
  });
});

describe("buildWidgetSrcdoc editor state", () => {
  type Call = { url: string; method: string };
  type StateApi = {
    state: { get(): Promise<unknown>; set(v: unknown): Promise<void> };
    userState: {
      get(k: string): Promise<unknown>;
      getAll(): Promise<Record<string, unknown>>;
      set(k: string, v: unknown): Promise<void>;
      increment(k: string, n?: number): Promise<number>;
      delete(k: string): Promise<void>;
    };
  };

  /** A fake overlay origin holding real saved values, recording every request. */
  function realStore() {
    const calls: Call[] = [];
    const fetch = async (url: string, init?: { method?: string }) => {
      calls.push({ url, method: init?.method ?? "GET" });
      const body = url.includes("/user-state")
        ? url.includes("?key=")
          ? { value: url.endsWith("count") ? 41 : null }
          : { state: { count: 41, title: "real" } }
        : { state: { best: 7 } };
      return { ok: true, status: 200, json: async () => body };
    };
    return { calls, fetch };
  }

  function bootEditor(withSession: boolean) {
    const store = realStore();
    const posted: unknown[] = [];
    const { global, post } = boot("", {}, {
      overlayOrigin: "https://overlay.test",
      editor: true,
      fetch: store.fetch,
      posted,
    });
    if (withSession) {
      post({ type: "onWidgetLoad", payload: { fieldData: {}, session: { subscriberToken: "tok", overlayItemId: "item-1" } } });
    }
    return { sw: global.StreamWizard as StateApi, calls: store.calls, posted, post, global };
  }

  test("reads the real values on the overlay canvas", async () => {
    const { sw, calls } = bootEditor(true);
    expect(await sw.state.get()).toEqual({ best: 7 });
    expect(await sw.userState.get("count")).toBe(41);
    expect(await sw.userState.getAll()).toEqual({ count: 41, title: "real" });
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });

  test("writes never send a request and are reported to the editor", async () => {
    const { sw, calls, posted } = bootEditor(true);
    await sw.state.set({ best: 9 });
    await sw.userState.set("title", "editor");
    expect(await sw.userState.increment("count", 2)).toBe(43);
    await sw.userState.delete("title");

    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
    expect(await sw.state.get()).toEqual({ best: 9 });
    expect(await sw.userState.getAll()).toEqual({ count: 43 });
    expect(posted).toEqual([
      { type: "swStateWrite", scope: "widget", value: { best: 9 } },
      { type: "swStateWrite", scope: "user", key: "title", value: "editor" },
      { type: "swStateWrite", scope: "user", key: "count", value: 43 },
      { type: "swStateWrite", scope: "user", key: "title", value: null },
    ]);
  });

  test("works without a session, as in the widget code editor", async () => {
    const { sw, calls } = bootEditor(false);
    expect(await sw.state.get()).toEqual({});
    expect(await sw.userState.get("count")).toBeNull();
    expect(await sw.userState.increment("count")).toBe(1);
    expect(calls).toEqual([]);
  });

  test("values from the panel win over the real ones and reach onChange", async () => {
    const { post, global } = boot(
      "var seen = []; StreamWizard.userState.onChange(function (k, v) { seen.push([k, v]); });",
      {},
      { overlayOrigin: "https://overlay.test", editor: true, fetch: realStore().fetch }
    );
    post({ type: "swEditorState", widgetState: { best: 100 }, userState: { count: 5 } });
    const state = global.StreamWizard as StateApi;
    expect(await state.state.get()).toEqual({ best: 100 });
    expect(await state.userState.get("count")).toBe(5);
    expect(global.seen).toEqual([["count", 5]]);

    // A live frame for a key the editor overrides is dropped; others pass.
    post({ type: "onEventReceived", payload: { listener: "streamwizard.user_state", event: { key: "count", value: 42 } } });
    post({ type: "onEventReceived", payload: { listener: "streamwizard.user_state", event: { key: "other", value: 1 } } });
    expect(global.seen).toEqual([["count", 5], ["other", 1]]);
  });

  test("a late echo from the editor doesn't roll a newer write back", async () => {
    const { sw, post } = bootEditor(false);
    await sw.userState.increment("deaths");
    await sw.userState.increment("deaths");
    await sw.state.set({ loads: 2 });
    // Snapshots sent before the writes above landed.
    post({ type: "swEditorState", widgetState: { loads: 1 }, userState: { deaths: 1 } });
    expect(await sw.userState.get("deaths")).toBe(2);
    expect(await sw.state.get()).toEqual({ loads: 2 });
    // Once the editor has caught up, its values count again.
    post({ type: "swEditorState", widgetState: { loads: 2 }, userState: { deaths: 2 } });
    post({ type: "swEditorState", widgetState: { loads: 9 }, userState: { deaths: 9 } });
    expect(await sw.userState.get("deaths")).toBe(9);
    expect(await sw.state.get()).toEqual({ loads: 9 });
  });

  test("rejects a widget state that the real route would refuse", async () => {
    const { sw } = bootEditor(true);
    await expect(sw.state.set([1, 2])).rejects.toThrow("400");
  });

  test("hides the raw endpoints so a hand-rolled fetch can't write either", () => {
    const { global } = bootEditor(true);
    const sw = global.StreamWizard as { stateUrl: unknown; userStateUrl: unknown };
    expect([sw.stateUrl, sw.userStateUrl]).toEqual([null, null]);
  });

  test("a live overlay document keeps the real write path", () => {
    const srcdoc = buildWidgetSrcdoc("<div></div>", "", "", FIELDS, {}, "https://overlay.test");
    expect(srcdoc).not.toContain("swStateWrite");
    expect(srcdoc).not.toContain("swEditorState");
  });
});
