import { describe, expect, it } from "bun:test";
import { parseInputEvent } from "./input-events";

describe("parseInputEvent", () => {
  it("parses a created browser source", () => {
    expect(
      parseInputEvent("InputCreated", {
        inputName: "Alerts",
        inputUuid: "x",
        inputKind: "browser_source",
        inputSettings: { url: "https://example.com" },
        defaultInputSettings: {},
      }),
    ).toEqual({
      type: "InputCreated",
      inputName: "Alerts",
      inputKind: "browser_source",
      inputSettings: { url: "https://example.com" },
    });
  });

  it("parses a settings change and a rename", () => {
    expect(parseInputEvent("InputSettingsChanged", { inputName: "Alerts", inputSettings: {} })?.type).toBe(
      "InputSettingsChanged",
    );
    expect(parseInputEvent("InputNameChanged", { oldInputName: "A", inputName: "B" })).toEqual({
      type: "InputNameChanged",
      oldInputName: "A",
      inputName: "B",
    });
  });

  it("refuses a shape it doesn't know", () => {
    expect(parseInputEvent("InputCreated", { inputName: "Alerts" })).toBeNull();
    expect(parseInputEvent("InputSettingsChanged", null)).toBeNull();
    expect(parseInputEvent("SceneItemRemoved", { inputName: "Alerts" })).toBeNull();
  });
});
