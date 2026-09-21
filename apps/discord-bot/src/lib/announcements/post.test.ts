import { describe, expect, test } from "bun:test";
import { createAnnouncement, type Announcement, type AnnouncementPayload } from "@repo/discord-message";
import { AnnouncementError, deleteAnnouncementMessage, postAnnouncement, withAnnouncementLock, type AnnouncementChannel } from "./post";

type Call = { op: "send" | "edit" | "delete"; id?: string; payload?: AnnouncementPayload };

/** A channel that records what happened to it. `gone` ids answer like Discord does for a deleted message. */
function fakeChannel(id = "100", { gone = [] as string[] } = {}) {
  const calls: Call[] = [];
  let next = 1;
  const channel: AnnouncementChannel = {
    id,
    async send(payload) {
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
const announcement = (patch: Partial<Announcement> = {}): Announcement => ({
  ...createAnnouncement(),
  title: "News from [server.name]",
  body: "Hello all [server.member_count] of you.",
  ...patch,
});

describe("postAnnouncement", () => {
  test("first post sends one message with the placeholders filled in", async () => {
    const { channel, calls } = fakeChannel();
    const result = await postAnnouncement({ channel, announcement: announcement(), values });

    expect(result).toEqual({ messageId: "100-new-1", resent: false });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.payload!.embeds[0]).toMatchObject({ title: "News from StreamWizard", description: "Hello all 1,204 of you." });
    expect(calls[0]!.payload!.content).toBe("");
  });

  test("with a previous message it edits in place and doesn't ping again", async () => {
    const { channel, ops } = fakeChannel();
    const result = await postAnnouncement({ channel, announcement: announcement({ mention: { kind: "everyone" } }), values, previousMessageId: "old" });

    expect(result).toEqual({ messageId: "old", resent: false });
    expect(ops()).toEqual(["edit:old"]);
  });

  test("when the previous message is gone it sends fresh and says so", async () => {
    const { channel, ops } = fakeChannel("100", { gone: ["old"] });
    const result = await postAnnouncement({ channel, announcement: announcement(), values, previousMessageId: "old" });

    expect(result).toEqual({ messageId: "100-new-1", resent: true });
    expect(ops()).toEqual(["send:100-new-1"]);
  });

  test("other Discord errors on edit are thrown as they are", async () => {
    const { channel } = fakeChannel();
    channel.messages.edit = async () => {
      throw Object.assign(new Error("Missing Permissions"), { code: 50013 });
    };
    await expect(postAnnouncement({ channel, announcement: announcement(), values, previousMessageId: "old" })).rejects.toThrow("Missing Permissions");
  });

  test("an announcement that fails the limits after filling in is refused before anything is sent", async () => {
    const { channel, calls } = fakeChannel();
    const long = announcement({ title: "[server.name]".repeat(20) });
    await expect(postAnnouncement({ channel, announcement: long, values: { "server.name": "x".repeat(20) } })).rejects.toBeInstanceOf(AnnouncementError);
    expect(calls).toHaveLength(0);
  });

  test("a role ping goes in the content and the allowed mentions", async () => {
    const { channel, calls } = fakeChannel();
    await postAnnouncement({ channel, announcement: announcement({ mention: { kind: "role", roleId: "42" } }), values });
    expect(calls[0]!.payload).toMatchObject({ content: "<@&42>", allowedMentions: { parse: [], roles: ["42"] } });
  });
});

describe("deleteAnnouncementMessage", () => {
  test("a message a mod already removed is fine", async () => {
    const { channel } = fakeChannel("100", { gone: ["old"] });
    await expect(deleteAnnouncementMessage(channel, "old")).resolves.toBeUndefined();
  });

  test("other failures are thrown", async () => {
    const { channel } = fakeChannel();
    channel.messages.delete = async () => {
      throw Object.assign(new Error("Missing Permissions"), { code: 50013 });
    };
    await expect(deleteAnnouncementMessage(channel, "old")).rejects.toThrow("Missing Permissions");
  });
});

describe("withAnnouncementLock", () => {
  test("a second run for the same announcement gets null while the first is busy", async () => {
    let release!: () => void;
    const first = withAnnouncementLock("g", "a", () => new Promise<string>((resolve) => (release = () => resolve("done"))));
    expect(await withAnnouncementLock("g", "a", async () => "second")).toBeNull();
    expect(await withAnnouncementLock("g", "b", async () => "other")).toBe("other");
    release();
    expect(await first).toBe("done");
    expect(await withAnnouncementLock("g", "a", async () => "again")).toBe("again");
  });
});
