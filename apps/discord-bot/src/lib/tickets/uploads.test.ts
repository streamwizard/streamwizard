import { describe, expect, test } from "bun:test";
import { GuildPremiumTier, type MessageCreateOptions } from "discord.js";
import {
  checkUploads,
  chunk,
  formatBytes,
  guildUploadLimit,
  isAllowedUpload,
  NO_ATTACH_PERMISSION,
  postWithUploads,
  skippedForOpener,
  skippedForStaff,
  type TicketUpload,
} from "./uploads";

const MB = 1024 * 1024;

const upload = (name: string, patch: Partial<TicketUpload> = {}): TicketUpload => ({
  fieldId: "f-shots",
  name,
  url: `https://cdn.discordapp.com/ephemeral-attachments/1/2/${name}`,
  size: 1000,
  contentType: null,
  ...patch,
});

describe("upload rules", () => {
  test("the upload limit grows with boosts", () => {
    expect(guildUploadLimit(GuildPremiumTier.None)).toBe(10 * MB);
    expect(guildUploadLimit(GuildPremiumTier.Tier1)).toBe(10 * MB);
    expect(guildUploadLimit(GuildPremiumTier.Tier2)).toBe(50 * MB);
    expect(guildUploadLimit(GuildPremiumTier.Tier3)).toBe(100 * MB);
  });

  test("images and common docs pass, by extension whatever the case", () => {
    for (const name of [
      "shot.PNG",
      "a.jpg",
      "a.jpeg",
      "a.gif",
      "a.webp",
      "report.pdf",
      "notes.txt",
      "obs.log",
      "logs.zip",
    ]) {
      expect(isAllowedUpload({ name, contentType: null })).toBe(true);
    }
  });

  test("anything else is turned away, even with an image type on it", () => {
    expect(isAllowedUpload({ name: "setup.exe", contentType: "image/png" })).toBe(false);
    expect(isAllowedUpload({ name: "clip.mp4", contentType: "video/mp4" })).toBe(false);
    expect(isAllowedUpload({ name: ".png", contentType: null })).toBe(false);
  });

  test("a name without an extension goes by its content type", () => {
    expect(isAllowedUpload({ name: "screenshot", contentType: "image/png" })).toBe(true);
    expect(isAllowedUpload({ name: "notes", contentType: "text/plain; charset=utf-8" })).toBe(true);
    expect(isAllowedUpload({ name: "binary", contentType: "application/octet-stream" })).toBe(false);
  });

  test("files over the limit or of the wrong type are skipped with a reason", () => {
    const { accepted, skipped } = checkUploads(
      [upload("ok.png"), upload("huge.png", { size: 11 * MB }), upload("virus.exe")],
      10 * MB,
    );
    expect(accepted.map((u) => u.name)).toEqual(["ok.png"]);
    expect(skipped).toEqual([
      { name: "huge.png", reason: "bigger than the 10 MB this server allows" },
      { name: "virus.exe", reason: "that file type isn't allowed" },
    ]);
  });

  test("sizes read like people write them", () => {
    expect(formatBytes(10 * MB)).toBe("10 MB");
    expect(formatBytes(1.5 * MB)).toBe("1.5 MB");
    expect(formatBytes(300 * 1024)).toBe("300 KB");
    expect(formatBytes(10)).toBe("1 KB");
  });

  test("chunks of Discord's ten", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 10)).toEqual([]);
  });

  test("the notices name the files, with markdown in names escaped", () => {
    expect(skippedForOpener([])).toBe("");
    expect(skippedForStaff([])).toBe("");
    const skipped = [{ name: "my_*shot*.png", reason: "that file type isn't allowed" }];
    expect(skippedForOpener(skipped)).toBe(
      "Couldn't attach 1 file: **my\\_\\*shot\\*.png** (that file type isn't allowed). Post them in the ticket if you still need them.",
    );
    expect(skippedForStaff([...skipped, { name: "b.png", reason: "x" }])).toStartWith(
      "2 files from the form didn't make it:",
    );
  });
});

describe("posting the first message with uploads", () => {
  const intro: MessageCreateOptions = { content: "<@1>" };
  const fakeChannel = (fail: (options: MessageCreateOptions) => boolean = () => false) => {
    const sent: MessageCreateOptions[] = [];
    return {
      sent,
      async send(options: MessageCreateOptions) {
        if (fail(options)) throw new Error("Request entity too large");
        sent.push(options);
        return {};
      },
    };
  };
  const fetchFile = async (u: TicketUpload) => Buffer.from(u.name);
  const names = (options: MessageCreateOptions) =>
    (options.files ?? []).map((file) => (file as { name?: string }).name);

  test("without files, the intro goes out as before", async () => {
    const channel = fakeChannel();
    expect(await postWithUploads(channel, intro, [], { limitBytes: 10 * MB, canAttach: true, fetchFile })).toEqual([]);
    expect(channel.sent).toEqual([intro]);
  });

  test("files ride on the intro; past ten they follow in their own message", async () => {
    const channel = fakeChannel();
    const twelve = Array.from({ length: 12 }, (_, i) => upload(`${i}.png`));
    const skipped = await postWithUploads(channel, intro, twelve, { limitBytes: 10 * MB, canAttach: true, fetchFile });
    expect(skipped).toEqual([]);
    expect(channel.sent).toHaveLength(2);
    expect(channel.sent[0]?.content).toBe("<@1>");
    expect(names(channel.sent[0]!)).toHaveLength(10);
    expect(names(channel.sent[1]!)).toEqual(["10.png", "11.png"]);
    expect(channel.sent[1]?.allowedMentions).toEqual({ parse: [] });
  });

  test("a refused upload still opens the ticket, without the files", async () => {
    const channel = fakeChannel((options) => Boolean(options.files?.length));
    const skipped = await postWithUploads(channel, intro, [upload("a.png")], {
      limitBytes: 10 * MB,
      canAttach: true,
      fetchFile,
    });
    expect(channel.sent).toEqual([intro]);
    expect(skipped).toEqual([{ name: "a.png", reason: "Discord didn't take the upload" }]);
  });

  test("a file that can't be downloaded is skipped, the rest still go", async () => {
    const channel = fakeChannel();
    const flaky = async (u: TicketUpload) => {
      if (u.name === "gone.png") throw new Error("404");
      return Buffer.from(u.name);
    };
    const skipped = await postWithUploads(channel, intro, [upload("gone.png"), upload("ok.png")], {
      limitBytes: 10 * MB,
      canAttach: true,
      fetchFile: flaky,
    });
    expect(names(channel.sent[0]!)).toEqual(["ok.png"]);
    expect(skipped).toEqual([{ name: "gone.png", reason: "couldn't get it from Discord" }]);
  });

  test("without Attach Files nothing is downloaded and the reason says so", async () => {
    const channel = fakeChannel();
    let fetched = 0;
    const skipped = await postWithUploads(channel, intro, [upload("a.png")], {
      limitBytes: 10 * MB,
      canAttach: false,
      fetchFile: async (u) => {
        fetched++;
        return Buffer.from(u.name);
      },
    });
    expect(fetched).toBe(0);
    expect(channel.sent).toEqual([intro]);
    expect(skipped).toEqual([{ name: "a.png", reason: NO_ATTACH_PERMISSION }]);
  });

  test("an intro that can't be posted at all still throws, so the ticket is cleaned up", async () => {
    const channel = fakeChannel(() => true);
    await expect(
      postWithUploads(channel, intro, [upload("a.png")], { limitBytes: 10 * MB, canAttach: true, fetchFile }),
    ).rejects.toThrow();
  });
});
