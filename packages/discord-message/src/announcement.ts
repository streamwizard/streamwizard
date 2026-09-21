import { z } from "zod";
import { DISCORD_LIMITS, type MessageIssue } from "./limits";
import type { ApiActionRow, ApiEmbed } from "./plan";
import { DEFAULT_EMBED_COLOR } from "./presets";
import { SERVER_VARIABLES, findUnknownVariables, replaceVariables, type VariableValues } from "./variables";

// An announcement staff write in web-admin: a release, an event, a heads-up.
// Deliberately smaller than a built message: one embed, an optional image, an
// optional link button, and a ping. web-admin stores and previews it, the bot
// sends it, and both validate it here, so nothing may depend on discord.js,
// React or an env.

export const ANNOUNCEMENT_VERSION = 1;

/** Who the announcement pings. "here" is Discord's @here: members online right now. */
export const ANNOUNCEMENT_MENTION_KINDS = ["none", "everyone", "here", "role"] as const;
export type AnnouncementMentionKind = (typeof ANNOUNCEMENT_MENTION_KINDS)[number];

// Structural caps only, far above Discord's own limits: they stop a hostile
// payload from bloating the row. The real limits are in validateAnnouncement.
const text = (max: number) => z.string().max(max);

export const announcementMentionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.enum(["none", "everyone", "here"]) }),
  z.object({ kind: z.literal("role"), roleId: z.string().min(1).max(32) }),
]);

export const announcementButtonSchema = z.object({ label: text(400), url: text(2048) });

export const announcementSchema = z.object({
  version: z.literal(ANNOUNCEMENT_VERSION),
  title: text(1024),
  body: text(16384),
  /** 0xRRGGBB. */
  color: z.number().int().min(0).max(0xffffff),
  /** Shown large under the text. Discord fetches it, so any https address works. */
  imageUrl: z.string().url().max(2048).startsWith("https://").nullable(),
  /** One link button under the embed. */
  button: announcementButtonSchema.nullable(),
  mention: announcementMentionSchema,
});

export type AnnouncementMention = z.infer<typeof announcementMentionSchema>;
export type AnnouncementButton = z.infer<typeof announcementButtonSchema>;
export type Announcement = z.infer<typeof announcementSchema>;

/** Parses stored JSON. `null` when it isn't an announcement this version understands. */
export function parseAnnouncement(value: unknown): Announcement | null {
  const parsed = announcementSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** What a new announcement starts as. */
export function createAnnouncement(): Announcement {
  return {
    version: ANNOUNCEMENT_VERSION,
    title: "",
    body: "",
    color: DEFAULT_EMBED_COLOR,
    imageUrl: null,
    button: null,
    mention: { kind: "none" },
  };
}

/** An announcement is about the server, never one member. */
export const ANNOUNCEMENT_VARIABLES = SERVER_VARIABLES;

/** Quick picks for the embed colour. StreamWizard purple first (docs/branding.md), then the usual signals. */
export const ANNOUNCEMENT_COLORS: { name: string; value: number }[] = [
  { name: "StreamWizard", value: DEFAULT_EMBED_COLOR },
  { name: "Twitch", value: 0x9147ff },
  { name: "Blurple", value: 0x5865f2 },
  { name: "Green", value: 0x57f287 },
  { name: "Amber", value: 0xfee75c },
  { name: "Red", value: 0xed4245 },
];

export interface ValidateAnnouncementOptions {
  /** Placeholder keys the feature can fill. Omit to skip the check (the bot does, after filling them). */
  allowedVariables?: readonly string[];
}

const WEB_ADDRESS = /^https:\/\/[^\s]+$/i;

// Discord counts UTF-16 code units, the same as String.length.
const tooLong = (what: string, value: string, max: number): MessageIssue[] =>
  value.length > max ? [{ code: "too_long", elementId: null, message: `${what} is ${value.length} characters. Discord allows ${max}.` }] : [];

/** Everything wrong with the announcement. Empty means it can be sent. `elementId` is always null: there is one element. */
export function validateAnnouncement(announcement: Announcement, options: ValidateAnnouncementOptions = {}): MessageIssue[] {
  const issues: MessageIssue[] = [];
  const { title, body, button, mention } = announcement;

  if (!title.trim() && !body.trim()) {
    issues.push({ code: "embed_empty", elementId: null, message: "Give it a title or some text." });
  }
  issues.push(...tooLong("The title", title, DISCORD_LIMITS.embedTitle), ...tooLong("The text", body, DISCORD_LIMITS.embedDescription));

  if (button) {
    if (!button.label.trim()) {
      issues.push({ code: "button_incomplete", elementId: null, message: "The button needs a label." });
    }
    issues.push(...tooLong("The button label", button.label, DISCORD_LIMITS.buttonLabel));
    if (!WEB_ADDRESS.test(button.url)) {
      issues.push({ code: "button_incomplete", elementId: null, message: "The button needs a web address that starts with https://." });
    }
    issues.push(...tooLong("The button link", button.url, DISCORD_LIMITS.buttonUrl));
  }

  if (mention.kind === "role" && !mention.roleId) {
    issues.push({ code: "button_incomplete", elementId: null, message: "Pick the role to ping, or ping nobody." });
  }

  if (options.allowedVariables) {
    const unknown = new Set([title, body].flatMap((t) => findUnknownVariables(t, options.allowedVariables ?? [])));
    for (const key of unknown) {
      issues.push({ code: "unknown_variable", elementId: null, message: `[${key}] isn't a variable here, so Discord would show it as typed.` });
    }
  }
  return issues;
}

/** The announcement with every placeholder filled in. What the bot sends and what the preview shows. */
export function resolveAnnouncement(announcement: Announcement, values: VariableValues): Announcement {
  return { ...announcement, title: replaceVariables(announcement.title, values), body: replaceVariables(announcement.body, values) };
}

/** The line above the embed that carries the ping. Empty when nobody is pinged. */
export function announcementContent(mention: AnnouncementMention): string {
  switch (mention.kind) {
    case "everyone":
      return "@everyone";
    case "here":
      return "@here";
    case "role":
      return `<@&${mention.roleId}>`;
    default:
      return "";
  }
}

/** Never wider than the pick: a "@everyone" typed into the text stays text. */
export type AnnouncementAllowedMentions = { parse: "everyone"[]; roles?: string[] };

export interface AnnouncementPayload {
  content: string;
  embeds: ApiEmbed[];
  components: ApiActionRow[];
  allowedMentions: AnnouncementAllowedMentions;
}

/** One Discord message: the ping line, the embed, and the button row when there is one. */
export function toAnnouncementPayload(announcement: Announcement): AnnouncementPayload {
  const { title, body, color, imageUrl, button, mention } = announcement;
  const embed: ApiEmbed = {
    ...(title.trim() && { title }),
    ...(body.trim() && { description: body }),
    color,
    ...(imageUrl && { image: { url: imageUrl } }),
  };
  const allowedMentions: AnnouncementAllowedMentions =
    mention.kind === "everyone" || mention.kind === "here"
      ? { parse: ["everyone"] }
      : mention.kind === "role"
        ? { parse: [], roles: [mention.roleId] }
        : { parse: [] };

  return {
    content: announcementContent(mention),
    embeds: [embed],
    components: button ? [{ type: 1, components: [{ type: 2, style: 5, label: button.label, url: button.url }] }] : [],
    allowedMentions,
  };
}
