import { isButtonActionKey } from "./buttons";
import type { BuiltMessage, ButtonsElement, EmbedElement } from "./schema";
import { isKnownTheme } from "./themes";
import { elementTexts, findUnknownVariables } from "./variables";

// Discord's own limits, plus the few of ours. web-admin runs these on the
// draft before Publish; the bot runs them again on the message with its
// placeholders filled in, since a long server name can push a title over.

export const DISCORD_LIMITS = {
  embedTitle: 256,
  embedDescription: 4096,
  embedFieldName: 256,
  embedFieldValue: 1024,
  embedFields: 25,
  embedFooter: 2048,
  /** Title, description, field names and values, and footer of one message's embeds combined. */
  embedTotalCharacters: 6000,
  embedsPerMessage: 10,
  buttonsPerRow: 5,
  buttonRowsPerMessage: 5,
  buttonLabel: 80,
  buttonUrl: 512,
  /** Alt text of an attachment, which is where a banner's label goes. */
  bannerText: 1024,
  /** Discord's upload cap for bots in servers without boosts. */
  imageBytes: 10 * 1024 * 1024,
} as const;

/** Ours: keeps a publish to a sane number of Discord messages. */
export const DEFAULT_MAX_ELEMENTS = 20;

export const BANNER_RECOMMENDED_SIZE = { width: 545, height: 127 } as const;

export const BANNER_IMAGE_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
} as const;

export type BannerImageType = keyof typeof BANNER_IMAGE_TYPES;

export type IssueCode =
  | "too_many_elements"
  | "no_elements"
  | "single_embed_only"
  | "embed_empty"
  | "too_long"
  | "too_many_fields"
  | "field_incomplete"
  | "embed_total_too_long"
  | "buttons_empty"
  | "too_many_buttons"
  | "button_incomplete"
  | "unknown_variable"
  | "unknown_theme"
  | "image_type"
  | "image_size";

export interface MessageIssue {
  code: IssueCode;
  /** The element to highlight; `null` for the message as a whole. */
  elementId: string | null;
  /** Sentence an admin can act on. */
  message: string;
}

export interface ValidateOptions {
  maxElements?: number;
  /** For uses that are one embed and nothing else, like a level-up message. */
  singleEmbed?: boolean;
  /** Placeholder keys the feature can fill. Omit to skip the check (the bot does, after filling them). */
  allowedVariables?: readonly string[];
}

// Discord counts UTF-16 code units, the same as String.length.
const tooLong = (elementId: string, what: string, value: string, max: number): MessageIssue[] =>
  value.length > max
    ? [{ code: "too_long", elementId, message: `${what} is ${value.length} characters. Discord allows ${max}.` }]
    : [];

export function embedCharacterCount(embed: EmbedElement): number {
  return (
    embed.title.length +
    embed.description.length +
    embed.footer.length +
    embed.fields.reduce((sum, field) => sum + field.name.length + field.value.length, 0)
  );
}

function validateEmbed(embed: EmbedElement): MessageIssue[] {
  const issues: MessageIssue[] = [];
  const hasText = [embed.title, embed.description, ...embed.fields.map((f) => f.name + f.value)].some((t) => t.trim());
  if (!hasText) {
    issues.push({ code: "embed_empty", elementId: embed.id, message: "This embed is empty. Give it a title or some text." });
  }
  issues.push(
    ...tooLong(embed.id, "Embed title", embed.title, DISCORD_LIMITS.embedTitle),
    ...tooLong(embed.id, "Embed text", embed.description, DISCORD_LIMITS.embedDescription),
    ...tooLong(embed.id, "Embed footer", embed.footer, DISCORD_LIMITS.embedFooter),
  );
  if (embed.fields.length > DISCORD_LIMITS.embedFields) {
    issues.push({
      code: "too_many_fields",
      elementId: embed.id,
      message: `This embed has ${embed.fields.length} fields. Discord allows ${DISCORD_LIMITS.embedFields}.`,
    });
  }
  for (const field of embed.fields) {
    if (!field.name.trim() || !field.value.trim()) {
      issues.push({ code: "field_incomplete", elementId: embed.id, message: "Every field needs a name and a value." });
      break;
    }
  }
  for (const field of embed.fields) {
    issues.push(
      ...tooLong(embed.id, "Field name", field.name, DISCORD_LIMITS.embedFieldName),
      ...tooLong(embed.id, "Field value", field.value, DISCORD_LIMITS.embedFieldValue),
    );
  }
  const total = embedCharacterCount(embed);
  if (total > DISCORD_LIMITS.embedTotalCharacters) {
    issues.push({
      code: "embed_total_too_long",
      elementId: embed.id,
      message: `This embed is ${total} characters in total. Discord allows ${DISCORD_LIMITS.embedTotalCharacters}.`,
    });
  }
  return issues;
}

const WEB_ADDRESS = /^https?:\/\/[^\s]+$/i;

function validateButtons(row: ButtonsElement): MessageIssue[] {
  const issues: MessageIssue[] = [];
  if (row.buttons.length === 0) {
    issues.push({ code: "buttons_empty", elementId: row.id, message: "This row has no buttons. Add one or remove the row." });
  }
  if (row.buttons.length > DISCORD_LIMITS.buttonsPerRow) {
    issues.push({
      code: "too_many_buttons",
      elementId: row.id,
      message: `This row has ${row.buttons.length} buttons. Discord allows ${DISCORD_LIMITS.buttonsPerRow}. Add a second row for the rest.`,
    });
  }
  for (const button of row.buttons) {
    const name = button.label.trim() ? `"${button.label.trim()}"` : "A button";
    if (!button.label.trim()) {
      issues.push({ code: "button_incomplete", elementId: row.id, message: "Every button needs a label." });
    }
    issues.push(...tooLong(row.id, "Button label", button.label, DISCORD_LIMITS.buttonLabel));
    if (button.kind === "link") {
      if (!WEB_ADDRESS.test(button.url)) {
        issues.push({ code: "button_incomplete", elementId: row.id, message: `${name} needs a web address that starts with https://.` });
      }
      issues.push(...tooLong(row.id, "Button link", button.url, DISCORD_LIMITS.buttonUrl));
    } else if (!isButtonActionKey(button.action)) {
      issues.push({ code: "button_incomplete", elementId: row.id, message: `${name} has an action that doesn't exist anymore. Pick another one.` });
    }
  }
  return issues;
}

/** Everything wrong with the message. Empty means it can be sent. */
export function validateMessage(message: BuiltMessage, options: ValidateOptions = {}): MessageIssue[] {
  const maxElements = options.maxElements ?? DEFAULT_MAX_ELEMENTS;
  const issues: MessageIssue[] = [];

  if (message.elements.length === 0) {
    issues.push({ code: "no_elements", elementId: null, message: "The message is empty. Add a banner, an embed or buttons." });
  }
  if (message.elements.length > maxElements) {
    issues.push({
      code: "too_many_elements",
      elementId: null,
      message: `The message has ${message.elements.length} elements. The limit is ${maxElements}.`,
    });
  }
  if (options.singleEmbed && (message.elements.length > 1 || message.elements.some((el) => el.type !== "embed"))) {
    issues.push({ code: "single_embed_only", elementId: null, message: "This message is one embed and nothing else." });
  }
  if (!isKnownTheme(message.themeId)) {
    issues.push({ code: "unknown_theme", elementId: null, message: "That theme doesn't exist anymore. Pick another one." });
  }

  for (const element of message.elements) {
    if (element.type === "banner") {
      issues.push(...tooLong(element.id, "Banner text", element.text, DISCORD_LIMITS.bannerText));
    } else if (element.type === "buttons") {
      issues.push(...validateButtons(element));
    } else {
      issues.push(...validateEmbed(element));
    }
    if (options.allowedVariables) {
      const unknown = new Set(elementTexts(element).flatMap((t) => findUnknownVariables(t, options.allowedVariables ?? [])));
      for (const key of unknown) {
        issues.push({
          code: "unknown_variable",
          elementId: element.id,
          message: `[${key}] isn't a variable here, so Discord would show it as typed.`,
        });
      }
    }
  }
  return issues;
}

/** Checks an upload before it goes anywhere. Type comes from the browser, so servers sniff the bytes too. */
export function validateBannerImage(file: { type: string; size: number }): MessageIssue[] {
  if (!(file.type in BANNER_IMAGE_TYPES)) {
    return [{ code: "image_type", elementId: null, message: "Banners are png, jpg or gif images." }];
  }
  if (file.size > DISCORD_LIMITS.imageBytes) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return [{ code: "image_size", elementId: null, message: `That image is ${mb} MB. Discord allows 10 MB.` }];
  }
  return [];
}

/** The image type the bytes really are, or `null`. Magic numbers for png, jpg and gif. */
export function sniffBannerImageType(bytes: Uint8Array): BannerImageType | null {
  const starts = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  return null;
}
