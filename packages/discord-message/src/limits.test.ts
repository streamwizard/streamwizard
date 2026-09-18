import { describe, expect, test } from "bun:test";
import { DISCORD_LIMITS, sniffBannerImageType, validateBannerImage, validateMessage } from "./limits";
import { createMessage } from "./model";
import type { EmbedDraft } from "./schema";
import { resolveMessage } from "./variables";

const embed = (patch: Partial<EmbedDraft> = {}): EmbedDraft => ({
  type: "embed", title: "Title", description: "Text", color: 0x9146ff, fields: [], footer: "", ...patch,
});
const codes = (...args: Parameters<typeof validateMessage>) => validateMessage(...args).map((i) => i.code);

describe("validateMessage", () => {
  test("a normal message has no issues", () => {
    expect(validateMessage(createMessage([{ type: "banner", text: "Welcome", image: null }, embed()]))).toEqual([]);
  });

  test("an empty message can't be published", () => {
    expect(codes(createMessage())).toEqual(["no_elements"]);
  });

  test("text at the limit passes, one over fails, and the issue points at the element", () => {
    const atLimit = createMessage([embed({ title: "x".repeat(DISCORD_LIMITS.embedTitle) })]);
    expect(validateMessage(atLimit)).toEqual([]);

    const over = createMessage([embed({ title: "x".repeat(DISCORD_LIMITS.embedTitle + 1) })]);
    const [issue] = validateMessage(over);
    expect(issue).toMatchObject({ code: "too_long", elementId: over.elements[0]!.id });
    expect(issue!.message).toBe("Embed title is 257 characters. Discord allows 256.");
  });

  test("description, footer and field limits", () => {
    expect(codes(createMessage([embed({ description: "x".repeat(4097) })]))).toEqual(["too_long"]);
    expect(codes(createMessage([embed({ footer: "x".repeat(2049) })]))).toEqual(["too_long"]);
    expect(codes(createMessage([embed({ fields: [{ name: "x".repeat(257), value: "v", inline: true }] })]))).toEqual(["too_long"]);
    expect(codes(createMessage([embed({ fields: [{ name: "n", value: "x".repeat(1025), inline: true }] })]))).toEqual(["too_long"]);
  });

  test("more than 25 fields, and fields missing a name or value", () => {
    const fields = Array.from({ length: 26 }, () => ({ name: "n", value: "v", inline: true }));
    expect(codes(createMessage([embed({ fields })]))).toEqual(["too_many_fields"]);
    expect(codes(createMessage([embed({ fields: [{ name: "n", value: " ", inline: true }] })]))).toEqual(["field_incomplete"]);
  });

  test("an embed over 6000 characters in total", () => {
    const fields = Array.from({ length: 3 }, () => ({ name: "n", value: "x".repeat(1000), inline: false }));
    expect(codes(createMessage([embed({ description: "x".repeat(4000), fields })]))).toEqual(["embed_total_too_long"]);
  });

  test("an embed with nothing in it", () => {
    expect(codes(createMessage([embed({ title: " ", description: "" })]))).toEqual(["embed_empty"]);
  });

  test("element cap is configurable", () => {
    const message = createMessage([embed(), embed(), embed()]);
    expect(codes(message, { maxElements: 2 })).toEqual(["too_many_elements"]);
    expect(codes(message, { maxElements: 3 })).toEqual([]);
  });

  test("single embed mode refuses banners and second embeds", () => {
    expect(codes(createMessage([embed()]), { singleEmbed: true })).toEqual([]);
    expect(codes(createMessage([embed(), embed()]), { singleEmbed: true })).toEqual(["single_embed_only"]);
    expect(codes(createMessage([{ type: "banner", text: "", image: null }]), { singleEmbed: true })).toEqual(["single_embed_only"]);
  });

  test("placeholders the feature can't fill are flagged once per element", () => {
    const message = createMessage([embed({ title: "[member.name]", description: "[member.name] in [server.name]" })]);
    const issues = validateMessage(message, { allowedVariables: ["server.name"] });
    expect(issues.map((i) => i.code)).toEqual(["unknown_variable"]);
    expect(issues[0]!.message).toContain("[member.name]");
    expect(validateMessage(message)).toEqual([]);
  });

  test("an unknown theme is an issue", () => {
    expect(codes({ ...createMessage([embed()]), themeId: "gone" })).toEqual(["unknown_theme"]);
  });

  test("the bot's check catches a title that only overflows once placeholders are filled", () => {
    const message = createMessage([embed({ title: `${"x".repeat(240)}[server.name]` })]);
    expect(validateMessage(message)).toEqual([]);
    const resolved = resolveMessage(message, { "server.name": "A very long server name" });
    expect(codes(resolved)).toEqual(["too_long"]);
  });
});

describe("banner images", () => {
  test("png, jpg and gif up to 10 MB pass", () => {
    for (const type of ["image/png", "image/jpeg", "image/gif"]) {
      expect(validateBannerImage({ type, size: DISCORD_LIMITS.imageBytes })).toEqual([]);
    }
  });

  test("other types and oversized files fail with a readable reason", () => {
    expect(validateBannerImage({ type: "image/svg+xml", size: 10 })[0]).toMatchObject({ code: "image_type" });
    expect(validateBannerImage({ type: "image/webp", size: 10 })[0]).toMatchObject({ code: "image_type" });
    const big = validateBannerImage({ type: "image/png", size: DISCORD_LIMITS.imageBytes + 1 })[0];
    expect(big).toMatchObject({ code: "image_size" });
    expect(big!.message).toBe("That image is 10.0 MB. Discord allows 10 MB.");
  });

  test("sniffs the real type from the first bytes", () => {
    expect(sniffBannerImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffBannerImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffBannerImageType(new TextEncoder().encode("GIF89a"))).toBe("image/gif");
    expect(sniffBannerImageType(new TextEncoder().encode("<svg xmlns"))).toBeNull();
    expect(sniffBannerImageType(new Uint8Array())).toBeNull();
  });
});

test("no issue message uses an em dash", () => {
  const message = createMessage([embed({ title: "x".repeat(300), description: "", fields: [{ name: "", value: "", inline: true }] })]);
  expect(JSON.stringify(validateMessage(message, { maxElements: 0, singleEmbed: true, allowedVariables: [] }))).not.toContain("—");
});
