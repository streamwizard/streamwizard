import { describe, expect, test } from "bun:test";
import {
  addElement,
  addEmbedField,
  applyTheme,
  createMessage,
  moveElement,
  removeElement,
  removeEmbedField,
  updateElement,
  updateEmbedField,
} from "./model";
import { MESSAGE_PRESETS, MESSAGE_TEMPLATES } from "./presets";
import { DEFAULT_THEME_ID, builtMessageSchema, parseBuiltMessage, type BannerElement, type EmbedElement } from "./schema";
import { THEMES, getTheme, resolveBannerSource } from "./themes";
import { validateMessage } from "./limits";
import { SERVER_VARIABLES } from "./variables";

const banner = (text: string) => ({ type: "banner" as const, text, image: null });
const three = () => createMessage([banner("a"), banner("b"), banner("c")]);
const texts = (message: ReturnType<typeof three>) => message.elements.map((el) => (el as BannerElement).text);

describe("message edits", () => {
  test("createMessage gives every element its own id", () => {
    const ids = three().elements.map((el) => el.id);
    expect(new Set(ids).size).toBe(3);
  });

  test("addElement appends to the end", () => {
    expect(texts(addElement(three(), banner("d")))).toEqual(["a", "b", "c", "d"]);
  });

  test("removeElement drops only that element", () => {
    const message = three();
    expect(texts(removeElement(message, message.elements[1]!.id))).toEqual(["a", "c"]);
  });

  test("moveElement reorders both ways and ignores unknown ids", () => {
    const message = three();
    const [a, , c] = message.elements;
    expect(texts(moveElement(message, a!.id, c!.id))).toEqual(["b", "c", "a"]);
    expect(texts(moveElement(message, c!.id, a!.id))).toEqual(["c", "a", "b"]);
    expect(moveElement(message, "nope", a!.id)).toBe(message);
  });

  test("edits never mutate the input", () => {
    const message = three();
    const snapshot = structuredClone(message);
    updateElement<BannerElement>(message, message.elements[0]!.id, { text: "changed" });
    moveElement(message, message.elements[0]!.id, message.elements[2]!.id);
    applyTheme(message, "glitch-rgb");
    expect(message).toEqual(snapshot);
  });

  test("embed fields can be added, edited and removed", () => {
    let message = createMessage([MESSAGE_PRESETS[0]!.draft]);
    const embedId = message.elements[0]!.id;
    message = addEmbedField(message, embedId);
    const fieldId = (message.elements[0] as EmbedElement).fields[0]!.id;
    message = updateEmbedField(message, embedId, fieldId, { name: "Watch", value: "Twitch" });
    expect((message.elements[0] as EmbedElement).fields).toEqual([{ id: fieldId, name: "Watch", value: "Twitch", inline: true }]);
    message = removeEmbedField(message, embedId, fieldId);
    expect((message.elements[0] as EmbedElement).fields).toEqual([]);
  });
});

describe("themes", () => {
  test("applyTheme restyles every banner, dropping per-banner uploads", () => {
    let message = three();
    message = updateElement<BannerElement>(message, message.elements[0]!.id, { image: { url: "https://cdn.example/a.png" } });
    const themed = applyTheme(message, "lofi-dusk");
    expect(themed.themeId).toBe("lofi-dusk");
    for (const el of themed.elements) expect(resolveBannerSource(el as BannerElement, themed)).toMatchObject({ kind: "theme" });
  });

  test("a banner's own upload wins over the theme", () => {
    const message = three();
    const withUpload = { ...(message.elements[0] as BannerElement), image: { url: "https://cdn.example/a.png" } };
    expect(resolveBannerSource(withUpload, message)).toEqual({ kind: "upload", url: "https://cdn.example/a.png" });
  });

  test("an unknown theme falls back to the default", () => {
    expect(getTheme("gone").id).toBe(DEFAULT_THEME_ID);
  });

  test("theme ids are unique and animated themes are gifs", () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
    for (const t of THEMES) expect(t.file.endsWith(t.animated ? ".gif" : ".png")).toBe(true);
  });

  test("every theme file exists", async () => {
    for (const t of THEMES) {
      const file = Bun.file(new URL(`../assets/themes/${t.file}`, import.meta.url));
      expect(await file.exists()).toBe(true);
    }
  });
});

describe("stored shape", () => {
  test("every template and every preset pass the schema and the limits", () => {
    const allowedVariables = SERVER_VARIABLES.map((v) => v.key);
    for (const template of MESSAGE_TEMPLATES) {
      const message = template.create();
      expect(builtMessageSchema.safeParse(message).success).toBe(true);
      expect(validateMessage(message, { allowedVariables })).toEqual([]);
    }

    const everything = createMessage(MESSAGE_PRESETS.map((p) => p.draft));
    expect(validateMessage(everything, { allowedVariables })).toEqual([]);
  });

  test("the builder offers the presets the page promises", () => {
    expect(MESSAGE_PRESETS.map((p) => p.id)).toEqual([
      "advanced-embed", "custom-banner", "buttons", "link-account-buttons", "welcome-embed", "welcome-banner", "rules-embed", "rules-banner",
      "invite-embed", "invite-banner", "mods-embed", "mods-banner", "links-embed", "links-banner",
    ]);
  });

  test("survives a JSON round trip, and junk parses to null", () => {
    const message = MESSAGE_TEMPLATES[1]!.create();
    expect(parseBuiltMessage(JSON.parse(JSON.stringify(message)))).toEqual(message);
    expect(parseBuiltMessage({ version: 2, elements: [] })).toBeNull();
    expect(parseBuiltMessage(null)).toBeNull();
  });

  test("rejects banner uploads that aren't https", () => {
    const message = three();
    const bad = { ...message, elements: [{ ...message.elements[0], image: { url: "http://cdn.example/a.png" } }] };
    expect(parseBuiltMessage(bad)).toBeNull();
  });
});
