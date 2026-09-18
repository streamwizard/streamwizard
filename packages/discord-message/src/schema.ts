import { z } from "zod";
import { BUTTON_STYLES } from "./buttons";

// The stored shape of a message an admin designed in the builder. web-admin
// writes it, the bot sends it, and both validate it with the same limits, so
// nothing here may depend on discord.js, React or an env.

export const MESSAGE_VERSION = 1;

/** Used when the message has no theme picked, and when themes are off. */
export const DEFAULT_THEME_ID = "classic";

const idSchema = z.string().min(1).max(64);

// Structural caps only, far above Discord's own limits: they stop a hostile
// payload from bloating the row. The real limits live in limits.ts, where they
// produce errors an admin can read.
const text = (max: number) => z.string().max(max);

/** An uploaded image that overrides the message theme for one banner. */
export const bannerImageSchema = z.object({
  url: z.string().url().max(2048).startsWith("https://"),
});

export const bannerElementSchema = z.object({
  id: idSchema,
  type: z.literal("banner"),
  /** The banner's label. Sent as the image's alt text, not drawn on the image. */
  text: text(400),
  /** `null` follows the message theme. */
  image: bannerImageSchema.nullable(),
});

export const embedFieldSchema = z.object({
  id: idSchema,
  name: text(1024),
  value: text(4096),
  inline: z.boolean(),
});

export const embedElementSchema = z.object({
  id: idSchema,
  type: z.literal("embed"),
  title: text(1024),
  description: text(16384),
  /** 0xRRGGBB. */
  color: z.number().int().min(0).max(0xffffff),
  fields: z.array(embedFieldSchema).max(50),
  footer: text(8192),
});

const buttonBase = { id: idSchema, label: text(400) };

export const messageButtonSchema = z.discriminatedUnion("kind", [
  /** Opens a web address. */
  z.object({ ...buttonBase, kind: z.literal("link"), url: text(2048) }),
  /** Runs one of BUTTON_ACTIONS (buttons.ts) in the bot. */
  z.object({ ...buttonBase, kind: z.literal("action"), action: z.string().max(64), style: z.enum(BUTTON_STYLES) }),
]);

/** One row of buttons. It sits under the embeds right before it, or stands alone as a message of its own. */
export const buttonsElementSchema = z.object({
  id: idSchema,
  type: z.literal("buttons"),
  buttons: z.array(messageButtonSchema).max(25),
});

export const messageElementSchema = z.discriminatedUnion("type", [bannerElementSchema, embedElementSchema, buttonsElementSchema]);

export const builtMessageSchema = z.object({
  version: z.literal(MESSAGE_VERSION),
  themeId: z.string().min(1).max(64),
  elements: z.array(messageElementSchema).max(100),
});

export type BannerImage = z.infer<typeof bannerImageSchema>;
export type BannerElement = z.infer<typeof bannerElementSchema>;
export type EmbedField = z.infer<typeof embedFieldSchema>;
export type EmbedElement = z.infer<typeof embedElementSchema>;
export type MessageButton = z.infer<typeof messageButtonSchema>;
export type ButtonsElement = z.infer<typeof buttonsElementSchema>;
export type MessageElement = z.infer<typeof messageElementSchema>;
export type BuiltMessage = z.infer<typeof builtMessageSchema>;

/** An element before it joins a message: presets describe these. */
export type BannerDraft = Omit<BannerElement, "id">;
export type EmbedDraft = Omit<EmbedElement, "id" | "fields"> & { fields: Omit<EmbedField, "id">[] };
type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;
export type ButtonDraft = WithoutId<MessageButton>;
export type ButtonsDraft = { type: "buttons"; buttons: ButtonDraft[] };
export type ElementDraft = BannerDraft | EmbedDraft | ButtonsDraft;

/** Parses stored JSON. `null` when it isn't a message this version understands. */
export function parseBuiltMessage(value: unknown): BuiltMessage | null {
  const parsed = builtMessageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
