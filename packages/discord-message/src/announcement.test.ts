import { describe, expect, test } from "bun:test";
import {
  ANNOUNCEMENT_VARIABLES,
  createAnnouncement,
  parseAnnouncement,
  resolveAnnouncement,
  toAnnouncementPayload,
  validateAnnouncement,
  type Announcement,
} from "./announcement";
import { DISCORD_LIMITS } from "./limits";

const announcement = (patch: Partial<Announcement> = {}): Announcement => ({
  ...createAnnouncement(),
  title: "Release 2.0",
  body: "It's out. Go update.",
  ...patch,
});

const OPTIONS = { allowedVariables: ANNOUNCEMENT_VARIABLES.map((v) => v.key) };
const codes = (a: Announcement) => validateAnnouncement(a, OPTIONS).map((i) => i.code);

describe("parseAnnouncement", () => {
  test("round-trips what createAnnouncement makes", () => {
    const blank = createAnnouncement();
    expect(parseAnnouncement(JSON.parse(JSON.stringify(blank)))).toEqual(blank);
  });

  test("rejects a shape from another version, an http image and a role without an id", () => {
    expect(parseAnnouncement({ ...announcement(), version: 2 })).toBeNull();
    expect(parseAnnouncement(announcement({ imageUrl: "http://example.com/a.png" }))).toBeNull();
    expect(parseAnnouncement({ ...announcement(), mention: { kind: "role" } })).toBeNull();
    expect(parseAnnouncement("nope")).toBeNull();
  });
});

describe("validateAnnouncement", () => {
  test("a normal announcement has no issues", () => {
    expect(validateAnnouncement(announcement(), OPTIONS)).toEqual([]);
  });

  test("needs a title or some text", () => {
    expect(codes(announcement({ title: " ", body: "" }))).toEqual(["embed_empty"]);
    expect(codes(announcement({ title: "", body: "Text only" }))).toEqual([]);
  });

  test("text at the limit passes, one over fails, with a sentence the admin can act on", () => {
    expect(codes(announcement({ title: "x".repeat(DISCORD_LIMITS.embedTitle) }))).toEqual([]);
    const [issue] = validateAnnouncement(announcement({ title: "x".repeat(DISCORD_LIMITS.embedTitle + 1) }));
    expect(issue).toMatchObject({ code: "too_long", elementId: null });
    expect(issue!.message).toBe("The title is 257 characters. Discord allows 256.");
    expect(codes(announcement({ body: "x".repeat(DISCORD_LIMITS.embedDescription + 1) }))).toEqual(["too_long"]);
  });

  test("a button needs a label and an https address", () => {
    expect(codes(announcement({ button: { label: "Read more", url: "https://streamwizard.org/blog" } }))).toEqual([]);
    expect(codes(announcement({ button: { label: " ", url: "https://streamwizard.org" } }))).toEqual(["button_incomplete"]);
    expect(codes(announcement({ button: { label: "Go", url: "http://streamwizard.org" } }))).toEqual(["button_incomplete"]);
    expect(codes(announcement({ button: { label: "Go", url: "streamwizard.org" } }))).toEqual(["button_incomplete"]);
    expect(codes(announcement({ button: { label: "x".repeat(DISCORD_LIMITS.buttonLabel + 1), url: "https://a.b" } }))).toEqual(["too_long"]);
  });

  test("placeholders the feature can't fill are flagged; server ones pass", () => {
    expect(codes(announcement({ body: "Hello [server.name], all [server.member_count] of you" }))).toEqual([]);
    expect(codes(announcement({ title: "Hi [member.name]" }))).toEqual(["unknown_variable"]);
    // Without the option the check is skipped (the bot validates after filling).
    expect(validateAnnouncement(announcement({ title: "Hi [member.name]" }))).toEqual([]);
  });
});

describe("resolveAnnouncement", () => {
  test("fills title and body, leaves the rest", () => {
    const resolved = resolveAnnouncement(announcement({ title: "[server.name] news", body: "[server.member_count] strong" }), {
      "server.name": "StreamWizard",
      "server.member_count": "1,204",
    });
    expect(resolved.title).toBe("StreamWizard news");
    expect(resolved.body).toBe("1,204 strong");
    expect(resolved.color).toBe(createAnnouncement().color);
  });
});

describe("toAnnouncementPayload", () => {
  test("nobody pinged: empty content, nothing allowed", () => {
    const payload = toAnnouncementPayload(announcement());
    expect(payload.content).toBe("");
    expect(payload.allowedMentions).toEqual({ parse: [] });
    expect(payload.embeds).toEqual([{ title: "Release 2.0", description: "It's out. Go update.", color: createAnnouncement().color }]);
    expect(payload.components).toEqual([]);
  });

  test("@everyone and @here go in the content and are allowed", () => {
    expect(toAnnouncementPayload(announcement({ mention: { kind: "everyone" } }))).toMatchObject({
      content: "@everyone",
      allowedMentions: { parse: ["everyone"] },
    });
    expect(toAnnouncementPayload(announcement({ mention: { kind: "here" } }))).toMatchObject({
      content: "@here",
      allowedMentions: { parse: ["everyone"] },
    });
  });

  test("a role ping allows only that role", () => {
    expect(toAnnouncementPayload(announcement({ mention: { kind: "role", roleId: "123456789012345678" } }))).toMatchObject({
      content: "<@&123456789012345678>",
      allowedMentions: { parse: [], roles: ["123456789012345678"] },
    });
  });

  test("an @everyone typed into the text is never allowed to ping", () => {
    const payload = toAnnouncementPayload(announcement({ body: "@everyone look" }));
    expect(payload.allowedMentions).toEqual({ parse: [] });
  });

  test("image and button only when set; empty title or body are left out of the embed", () => {
    const payload = toAnnouncementPayload(
      announcement({ title: "", imageUrl: "https://cdn.example/a.png", button: { label: "Read more", url: "https://streamwizard.org" } }),
    );
    expect(payload.embeds[0]).toEqual({ description: "It's out. Go update.", color: createAnnouncement().color, image: { url: "https://cdn.example/a.png" } });
    expect(payload.components).toEqual([{ type: 1, components: [{ type: 2, style: 5, label: "Read more", url: "https://streamwizard.org" }] }]);
  });
});
