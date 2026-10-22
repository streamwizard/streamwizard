import { describe, expect, it } from "bun:test";
import { toneFindings } from "./tone";

const messages = (texts: string[]) => toneFindings(texts).map((finding) => finding.message);

describe("toneFindings", () => {
  it("is quiet for plain writing", () => {
    expect(messages(["Set up OBS in ten minutes.", "It works on any PC from the last five years!"])).toEqual([]);
  });

  it("counts em dashes across every text, but leaves en dashes alone", () => {
    const found = messages(["One — two", "three — four", "Pricing – StreamWizard"]);
    expect(found).toHaveLength(1);
    expect(found[0]).toStartWith("2 em dashes.");
  });

  it("allows one exclamation mark per page", () => {
    expect(messages(["Done!"])).toEqual([]);
    expect(messages(["Done!", "Really!"])[0]).toStartWith("2 exclamation marks.");
  });

  it("flags stacked emoji but not a single one", () => {
    expect(messages(["Folder created. 📁"])).toEqual([]);
    expect(messages(["Let's go 🎮🔥✨"])).toEqual(["Stacked emoji. One is plenty."]);
    expect(messages(["Let's go 🎮 🔥"])).toEqual(["Stacked emoji. One is plenty."]);
  });

  it("names each filler word once, as whole words only", () => {
    expect(messages(["A seamless setup.", "Seamless again, and it will elevate your stream."])).toEqual([
      "“seamless”, “elevate” read like marketing filler. Say what it does instead.",
    ]);
    expect(messages(["Elevated latency and leveraged buyouts."])).toEqual([]);
  });
});
