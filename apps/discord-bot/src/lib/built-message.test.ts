import { describe, expect, test } from "bun:test";
import { createMessage, type BuiltMessage, type EmbedDraft } from "@repo/discord-message";
import {
  BuiltMessageError,
  BuiltMessageSendError,
  guildVariableValues,
  memberVariableValues,
  publishBuiltMessage,
  type BuiltMessageChannel,
  type BuiltMessagePayload,
} from "./built-message";

const CDN = "https://cdn.example";
const banner = (text: string, url?: string) => ({ type: "banner" as const, text, image: url ? { url } : null });
const embed = (patch: Partial<EmbedDraft> = {}): EmbedDraft => ({
  type: "embed", title: "Title", description: "Text", color: 0x9146ff, fields: [], footer: "", ...patch,
});

type Call = { op: "send" | "edit" | "delete"; id?: string; payload?: BuiltMessagePayload & { attachments?: [] } };

/** A channel that records what happened to it. `gone` ids answer like Discord does for a deleted message. */
function fakeChannel(id = "100", { gone = [] as string[], failSendAt = -1 } = {}) {
  const calls: Call[] = [];
  let next = 1;
  let sends = 0;
  const channel: BuiltMessageChannel = {
    id,
    async send(payload) {
      if (sends++ === failSendAt) throw new Error("Discord said no");
      const messageId = `${id}-new-${next++}`;
      calls.push({ op: "send", id: messageId, payload });
      return { id: messageId };
    },
    messages: {
      async edit(messageId, payload) {
        if (gone.includes(messageId)) throw Object.assign(new Error("Unknown Message"), { code: 10008 });
        calls.push({ op: "edit", id: messageId, payload });
        return { id: messageId };
      },
      async delete(messageId) {
        calls.push({ op: "delete", id: messageId });
        if (gone.includes(messageId)) throw Object.assign(new Error("Unknown Message"), { code: 10008 });
      },
    },
  };
  return { channel, calls, ops: () => calls.map((c) => `${c.op}:${c.id}`) };
}

const values = { "server.name": "StreamWizard", "server.member_count": "1,204" };
const publish = (channel: BuiltMessageChannel, message: BuiltMessage, extra: Partial<Parameters<typeof publishBuiltMessage>[0]> = {}) =>
  publishBuiltMessage({ channel, message, values, allowedUploadBase: CDN, resolveBannerFile: (s) => (s.kind === "upload" ? s.url : `/themes/${s.theme.file}`), ...extra });

describe("first publish", () => {
  test("sends banners and embeds in the order shown, with placeholders filled in", async () => {
    const { channel, calls } = fakeChannel();
    const message = createMessage([banner("Welcome to [server.name]"), embed({ title: "Hi from [server.name]" }), embed({ title: "Second" }), banner("Rules")]);
    const { messageIds } = await publish(channel, message);

    expect(calls.map((c) => c.op)).toEqual(["send", "send", "send"]);
    expect(messageIds).toEqual(["100-new-1", "100-new-2", "100-new-3"]);
    expect(calls[0]!.payload).toEqual({
      embeds: [],
      components: [],
      files: [{ attachment: "/themes/classic.png", name: "banner-1.png", description: "Welcome to StreamWizard" }],
      allowedMentions: { parse: [] },
    });
    expect(calls[1]!.payload!.embeds.map((e) => e.title)).toEqual(["Hi from StreamWizard", "Second"]);
    expect(calls[2]!.payload!.files[0]).toMatchObject({ name: "banner-3.png", description: "Rules" });
  });

  test("buttons ride along under the embed before them, and an edit without them clears them", async () => {
    const { channel, calls } = fakeChannel();
    const withButtons = createMessage([
      embed({ title: "Link up" }),
      { type: "buttons", buttons: [{ kind: "action", label: "Link [server.name]", action: "link_account", style: "primary" }] },
    ]);
    const { messageIds } = await publish(channel, withButtons);
    expect(messageIds).toEqual(["100-new-1"]);
    expect(calls[0]!.payload!.embeds).toHaveLength(1);
    expect(calls[0]!.payload!.components[0]!.components[0]).toMatchObject({ style: 1, label: "Link StreamWizard" });

    const without = { ...withButtons, elements: withButtons.elements.slice(0, 1) };
    await publish(channel, without, { previous: { channel, messageIds } });
    expect(calls[1]).toMatchObject({ op: "edit", id: "100-new-1", payload: { components: [] } });
  });

  test("animated themes and uploads keep their file type, and a banner without text has no alt text", async () => {
    const { channel, calls } = fakeChannel();
    const message = { ...createMessage([banner(""), banner("Own", `${CDN}/discord-banners/1/a.JPG?v=2`)]), themeId: "lofi-rain" };
    await publish(channel, message);
    expect(calls[0]!.payload!.files[0]).toEqual({ attachment: "/themes/lofi-rain.gif", name: "banner-1.gif" });
    expect(calls[1]!.payload!.files[0]).toMatchObject({ attachment: `${CDN}/discord-banners/1/a.JPG?v=2`, name: "banner-2.jpg" });
  });

  test("nothing pings unless the caller allows it", async () => {
    const { channel, calls } = fakeChannel();
    const message = createMessage([embed({ description: "Hi [member.mention] @everyone" })]);
    await publish(channel, message, { values: { "member.mention": "<@42>" }, allowedMentions: { parse: [], users: ["42"] } });
    expect(calls[0]!.payload!.allowedMentions).toEqual({ parse: [], users: ["42"] });
    expect(calls[0]!.payload!.embeds[0]!.description).toBe("Hi <@42> @everyone");
  });

  test("resolves theme files from the shared package by default", async () => {
    const { channel, calls } = fakeChannel();
    await publishBuiltMessage({ channel, message: createMessage([banner("Welcome")]), values });
    const path = calls[0]!.payload!.files[0]!.attachment;
    expect(path.endsWith("/assets/themes/classic.png")).toBe(true);
    expect(await Bun.file(path).exists()).toBe(true);
  });
});

describe("publishing again", () => {
  test("edits the messages where they stand, replacing the old attachment", async () => {
    const { channel, calls, ops } = fakeChannel();
    const message = createMessage([banner("Welcome"), embed()]);
    const { messageIds } = await publish(channel, message, { previous: { channel, messageIds: ["a", "b"] } });
    expect(ops()).toEqual(["edit:a", "edit:b"]);
    expect(messageIds).toEqual(["a", "b"]);
    expect(calls[0]!.payload).toMatchObject({ attachments: [], embeds: [] });
    // A slot that was a banner and is now embeds must lose its image too.
    expect(calls[1]!.payload).toMatchObject({ attachments: [], files: [] });
  });

  test("a longer message edits what exists and posts the rest after it", async () => {
    const { channel, ops } = fakeChannel();
    const message = createMessage([banner("a"), embed(), banner("b")]);
    const { messageIds } = await publish(channel, message, { previous: { channel, messageIds: ["a"] } });
    expect(ops()).toEqual(["edit:a", "send:100-new-1", "send:100-new-2"]);
    expect(messageIds).toEqual(["a", "100-new-1", "100-new-2"]);
  });

  test("a shorter message deletes the leftovers", async () => {
    const { channel, ops } = fakeChannel();
    const { messageIds } = await publish(channel, createMessage([embed()]), { previous: { channel, messageIds: ["a", "b", "c"] } });
    expect(ops()).toEqual(["edit:a", "delete:b", "delete:c"]);
    expect(messageIds).toEqual(["a"]);
  });

  test("when someone deleted one of the messages, everything is posted fresh so the order holds", async () => {
    const { channel, ops } = fakeChannel("100", { gone: ["b"] });
    const message = createMessage([banner("a"), embed(), banner("c")]);
    const { messageIds } = await publish(channel, message, { previous: { channel, messageIds: ["a", "b", "c"] } });
    expect(ops()).toEqual(["edit:a", "delete:a", "delete:b", "delete:c", "send:100-new-1", "send:100-new-2", "send:100-new-3"]);
    expect(messageIds).toEqual(["100-new-1", "100-new-2", "100-new-3"]);
  });

  test("a new channel gets the message and the old channel is cleaned up", async () => {
    const old = fakeChannel("old");
    const fresh = fakeChannel("new");
    const { messageIds } = await publish(fresh.channel, createMessage([embed()]), { previous: { channel: old.channel, messageIds: ["a", "b"] } });
    expect(old.ops()).toEqual(["delete:a", "delete:b"]);
    expect(fresh.ops()).toEqual(["send:new-new-1"]);
    expect(messageIds).toEqual(["new-new-1"]);
  });

  test("an old channel that no longer exists doesn't block the publish", async () => {
    const { channel, ops } = fakeChannel();
    await publish(channel, createMessage([embed()]), { previous: { channel: null, messageIds: ["a"] } });
    expect(ops()).toEqual(["send:100-new-1"]);
  });
});

describe("refusing to send", () => {
  test("limits are checked after placeholders are filled, and nothing is sent", async () => {
    const { channel, calls } = fakeChannel();
    const message = createMessage([embed({ title: `${"x".repeat(240)}[server.name]` })]);
    const attempt = publish(channel, message, { values: { "server.name": "A long server name" } });
    await expect(attempt).rejects.toBeInstanceOf(BuiltMessageError);
    const error = (await attempt.catch((e) => e)) as BuiltMessageError;
    expect(error.issues[0]).toMatchObject({ code: "too_long", elementId: message.elements[0]!.id });
    expect(calls).toEqual([]);
  });

  test("an empty message and the caller's own options are enforced", async () => {
    const { channel } = fakeChannel();
    await expect(publish(channel, createMessage())).rejects.toBeInstanceOf(BuiltMessageError);
    await expect(publish(channel, createMessage([embed(), embed()]), { validate: { singleEmbed: true } })).rejects.toBeInstanceOf(BuiltMessageError);
  });

  test("uploaded banners from outside the CDN, or with no CDN configured", async () => {
    const { channel, calls } = fakeChannel();
    const message = createMessage([banner("x", "https://evil.example/a.png")]);
    await expect(publish(channel, message)).rejects.toBeInstanceOf(BuiltMessageError);
    await expect(publish(channel, createMessage([banner("x", `${CDN}.evil.example/a.png`)]))).rejects.toBeInstanceOf(BuiltMessageError);
    await expect(publish(channel, createMessage([banner("x", `${CDN}/a.png`)]), { allowedUploadBase: undefined })).rejects.toBeInstanceOf(BuiltMessageError);
    expect(calls).toEqual([]);
  });
});

test("a failure partway reports every message that may still be in the channel", async () => {
  const { channel } = fakeChannel("100", { failSendAt: 1 });
  const message = createMessage([banner("a"), embed(), banner("c")]);
  const error = (await publish(channel, message).catch((e) => e)) as BuiltMessageSendError;
  expect(error).toBeInstanceOf(BuiltMessageSendError);
  expect(error.messageIds).toEqual(["100-new-1"]);

  const editing = fakeChannel("100", { failSendAt: 0 });
  const second = (await publish(editing.channel, message, { previous: { channel: editing.channel, messageIds: ["a"] } }).catch((e) => e)) as BuiltMessageSendError;
  expect(second.messageIds).toEqual(["a"]);
});

describe("variable values", () => {
  test("guild values escape markdown in the server name and format the count", () => {
    expect(guildVariableValues({ name: "**Bold** server", memberCount: 12345 })).toEqual({
      "server.name": "\\*\\*Bold\\*\\* server",
      "server.member_count": "12,345",
    });
  });

  test("member values add a mention and the display name", () => {
    const member = { id: "42", displayName: "Wum_pus", guild: { name: "SW", memberCount: 5 } };
    expect(memberVariableValues(member as never)).toEqual({
      "server.name": "SW",
      "server.member_count": "5",
      "member.mention": "<@42>",
      "member.name": "Wum\\_pus",
    });
  });
});
