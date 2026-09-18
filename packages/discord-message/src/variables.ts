import type { BuiltMessage, MessageElement } from "./schema";

// Placeholders look like [server.name]. The dot is required and a "(" may not
// follow, so ordinary bracketed text and markdown links, [twitch.tv](https://…)
// included, stay text.

export interface VariableDefinition {
  /** Without brackets, e.g. "server.name". */
  key: string;
  /** Shown on the chip and in the insert menu. */
  label: string;
  /** Stand-in value for the preview. */
  sample: string;
}

export const SERVER_VARIABLES: VariableDefinition[] = [
  { key: "server.name", label: "Server name", sample: "StreamWizard" },
  { key: "server.member_count", label: "Member count", sample: "1,204" },
];

export const MEMBER_VARIABLES: VariableDefinition[] = [
  { key: "member.mention", label: "Member mention", sample: "@Wumpus" },
  { key: "member.name", label: "Member name", sample: "Wumpus" },
];

/** What every feature with a member in context can offer. */
export const CORE_VARIABLES: VariableDefinition[] = [...SERVER_VARIABLES, ...MEMBER_VARIABLES];

export type VariableValues = Record<string, string>;

const VARIABLE_PATTERN = /\[([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)\](?!\()/g;

export type TextSegment = { type: "text"; value: string } | { type: "variable"; key: string; raw: string };

/** Splits text into plain runs and placeholders, in order. */
export function tokenize(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ type: "text", value: text.slice(cursor, index) });
    segments.push({ type: "variable", key: match[1] ?? "", raw: match[0] });
    cursor = index + match[0].length;
  }
  if (cursor < text.length) segments.push({ type: "text", value: text.slice(cursor) });
  return segments;
}

/** Placeholders without a value stay as typed, so a typo is visible in Discord instead of vanishing. */
export function replaceVariables(text: string, values: VariableValues): string {
  return text.replace(VARIABLE_PATTERN, (raw, key: string) => values[key] ?? raw);
}

/** Every text an element shows, for checks that look at all of it. */
export function elementTexts(element: MessageElement): string[] {
  if (element.type === "banner") return [element.text];
  if (element.type === "buttons") return element.buttons.map((button) => button.label);
  return [element.title, element.description, element.footer, ...element.fields.flatMap((f) => [f.name, f.value])];
}

/** Placeholder keys used in the text that aren't in `allowed`. */
export function findUnknownVariables(text: string, allowed: readonly string[]): string[] {
  const known = new Set(allowed);
  const unknown = new Set<string>();
  for (const segment of tokenize(text)) {
    if (segment.type === "variable" && !known.has(segment.key)) unknown.add(segment.key);
  }
  return [...unknown];
}

function mapElementTexts(element: MessageElement, map: (text: string) => string): MessageElement {
  if (element.type === "banner") return { ...element, text: map(element.text) };
  if (element.type === "buttons") return { ...element, buttons: element.buttons.map((button) => ({ ...button, label: map(button.label) })) };
  return {
    ...element,
    title: map(element.title),
    description: map(element.description),
    footer: map(element.footer),
    fields: element.fields.map((field) => ({ ...field, name: map(field.name), value: map(field.value) })),
  };
}

/** The message with every placeholder filled in. What the bot sends and what the preview shows. */
export function resolveMessage(message: BuiltMessage, values: VariableValues): BuiltMessage {
  return { ...message, elements: message.elements.map((el) => mapElementTexts(el, (t) => replaceVariables(t, values))) };
}

export function sampleValues(variables: readonly VariableDefinition[]): VariableValues {
  return Object.fromEntries(variables.map((v) => [v.key, v.sample]));
}
