import { describe, expect, test } from "bun:test";
import { createMessage } from "./model";
import { planDiscordMessages, toApiEmbed } from "./plan";
import type { EmbedDraft, EmbedElement } from "./schema";

const banner = (text: string, url?: string) => ({ type: "banner" as const, text, image: url ? { url } : null });
const embed = (patch: Partial<EmbedDraft> = {}): EmbedDraft => ({
  type: "embed", title: "Title", description: "Text", color: 0x9146ff, fields: [], footer: "", ...patch,
});

describe("planDiscordMessages", () => {
  test("keeps the order, gives banners their own message and groups embeds that follow each other", () => {
    const message = createMessage([banner("Welcome"), embed({ title: "a" }), embed({ title: "b" }), banner("Rules"), embed({ title: "c" })]);
    const planned = planDiscordMessages(message);
    expect(planned.map((p) => p.kind)).toEqual(["banner", "embeds", "banner", "embeds"]);
    expect(planned[1]).toMatchObject({ embeds: [{ title: "a" }, { title: "b" }] });
    expect(planned.flatMap((p) => (p.kind === "banner" ? [p.elementId] : p.elementIds))).toEqual(message.elements.map((el) => el.id));
  });

  test("starts a new message after 10 embeds", () => {
    const planned = planDiscordMessages(createMessage(Array.from({ length: 11 }, () => embed())));
    expect(planned.map((p) => (p.kind === "embeds" ? p.embeds.length : 0))).toEqual([10, 1]);
  });

  test("starts a new message before the combined text passes 6000 characters", () => {
    const big = embed({ description: "x".repeat(3500) });
    const planned = planDiscordMessages(createMessage([big, big]));
    expect(planned).toHaveLength(2);
  });

  test("banners carry their label as alt text and their image source", () => {
    const message = { ...createMessage([banner(" Welcome "), banner("Own", "https://cdn.example/own.png")]), themeId: "lofi-dusk" };
    const [themed, uploaded] = planDiscordMessages(message);
    expect(themed).toMatchObject({ kind: "banner", altText: "Welcome", source: { kind: "theme", theme: { id: "lofi-dusk" } } });
    expect(uploaded).toMatchObject({ source: { kind: "upload", url: "https://cdn.example/own.png" } });
  });

  test("an empty message plans nothing", () => {
    expect(planDiscordMessages(createMessage())).toEqual([]);
  });
});

test("toApiEmbed leaves out blank parts, which Discord would reject as empty strings", () => {
  const element = createMessage([embed({ title: " ", description: "Body", footer: "" })]).elements[0] as EmbedElement;
  expect(toApiEmbed(element)).toEqual({ description: "Body", color: 0x9146ff });

  const full = createMessage([embed({ footer: "f", fields: [{ name: "n", value: "v", inline: true }] })]).elements[0] as EmbedElement;
  expect(toApiEmbed(full)).toEqual({
    title: "Title", description: "Text", color: 0x9146ff, footer: { text: "f" }, fields: [{ name: "n", value: "v", inline: true }],
  });
});
