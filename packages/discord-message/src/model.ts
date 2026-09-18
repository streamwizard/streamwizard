import {
  DEFAULT_THEME_ID,
  MESSAGE_VERSION,
  type BuiltMessage,
  type ButtonDraft,
  type ElementDraft,
  type EmbedElement,
  type EmbedField,
  type MessageButton,
  type MessageElement,
} from "./schema";

// Pure edits on a message. Every one returns a new message and leaves the
// input alone, so the builder can hand the result straight to onChange.

const newId = (): string => crypto.randomUUID();

export const createButton = (draft: ButtonDraft): MessageButton => ({ ...draft, id: newId() }) as MessageButton;

export function createElement(draft: ElementDraft): MessageElement {
  if (draft.type === "banner") return { ...draft, id: newId() };
  if (draft.type === "buttons") return { ...draft, id: newId(), buttons: draft.buttons.map(createButton) };
  return { ...draft, id: newId(), fields: draft.fields.map((field) => ({ ...field, id: newId() })) };
}

export function createMessage(drafts: readonly ElementDraft[] = [], themeId: string = DEFAULT_THEME_ID): BuiltMessage {
  return { version: MESSAGE_VERSION, themeId, elements: drafts.map(createElement) };
}

export function addElement(message: BuiltMessage, draft: ElementDraft): BuiltMessage {
  return { ...message, elements: [...message.elements, createElement(draft)] };
}

export function removeElement(message: BuiltMessage, elementId: string): BuiltMessage {
  return { ...message, elements: message.elements.filter((el) => el.id !== elementId) };
}

/** Moves an element to where `overId` sits now. Unknown ids leave the message as it was. */
export function moveElement(message: BuiltMessage, elementId: string, overId: string): BuiltMessage {
  const from = message.elements.findIndex((el) => el.id === elementId);
  const to = message.elements.findIndex((el) => el.id === overId);
  if (from === -1 || to === -1 || from === to) return message;
  const elements = [...message.elements];
  const [moved] = elements.splice(from, 1);
  if (!moved) return message;
  elements.splice(to, 0, moved);
  return { ...message, elements };
}

export function updateElement<T extends MessageElement>(
  message: BuiltMessage,
  elementId: string,
  patch: Partial<Omit<T, "id" | "type">>,
): BuiltMessage {
  return {
    ...message,
    elements: message.elements.map((el) => (el.id === elementId ? ({ ...el, ...patch } as MessageElement) : el)),
  };
}

const mapEmbedFields = (message: BuiltMessage, embedId: string, map: (fields: EmbedField[]) => EmbedField[]) =>
  updateElement<EmbedElement>(message, embedId, {
    fields: map(message.elements.find((el): el is EmbedElement => el.id === embedId && el.type === "embed")?.fields ?? []),
  });

export function addEmbedField(message: BuiltMessage, embedId: string, inline = true): BuiltMessage {
  return mapEmbedFields(message, embedId, (fields) => [...fields, { id: newId(), name: "", value: "", inline }]);
}

export function updateEmbedField(
  message: BuiltMessage,
  embedId: string,
  fieldId: string,
  patch: Partial<Omit<EmbedField, "id">>,
): BuiltMessage {
  return mapEmbedFields(message, embedId, (fields) => fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)));
}

export function removeEmbedField(message: BuiltMessage, embedId: string, fieldId: string): BuiltMessage {
  return mapEmbedFields(message, embedId, (fields) => fields.filter((f) => f.id !== fieldId));
}

/** Restyles every banner at once: per-banner uploads are dropped so they all follow the new theme. */
export function applyTheme(message: BuiltMessage, themeId: string): BuiltMessage {
  return {
    ...message,
    themeId,
    elements: message.elements.map((el) => (el.type === "banner" ? { ...el, image: null } : el)),
  };
}
