import { LabelBuilder, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import {
  TICKET_FIELD_TEXT_MAX,
  TICKET_FORM_MAX_FIELDS,
  TICKET_SUBJECT_MAX,
  ticketSelectOptions,
  type TicketAnswerInput,
  type TicketCategory,
  type TicketFormField,
  type TicketProduct,
} from "@repo/supabase/queries/ticket-config";
import { TICKET_IDS, ticketId } from "./ids";

// A category's ticket form: built from the fields web-admin configured, and
// read back by field id. Reading is pure (it takes lookups, not an
// interaction), so it is tested without Discord.

/** Fields the modal can actually show: a product question needs products, a select needs options. */
export function askableFields(fields: TicketFormField[], products: TicketProduct[]): TicketFormField[] {
  return fields
    .filter((field) => {
      if (field.kind === "product") return products.length > 0;
      if (field.kind === "select") return ticketSelectOptions(field).length > 0;
      return true;
    })
    .slice(0, TICKET_FORM_MAX_FIELDS);
}

const option = (o: { label: string; value: string; description?: string; emoji?: string | null }) => ({
  label: o.label.slice(0, 100),
  value: o.value,
  ...(o.description ? { description: o.description.slice(0, 100) } : {}),
  ...(o.emoji ? { emoji: o.emoji } : {}),
});

function fieldComponent(field: TicketFormField, products: TicketProduct[]): LabelBuilder {
  const label = new LabelBuilder().setLabel(field.label.slice(0, 45));

  if (field.kind === "product" || field.kind === "select") {
    const options =
      field.kind === "product"
        ? products.map((p) => option({ label: p.label, value: p.slug, description: p.description, emoji: p.emoji }))
        : ticketSelectOptions(field).map(option);
    const select = new StringSelectMenuBuilder()
      .setCustomId(field.id)
      .setMinValues(field.required ? 1 : 0)
      .setMaxValues(1)
      .setRequired(field.required)
      .addOptions(options);
    if (field.placeholder) select.setPlaceholder(field.placeholder);
    return label.setStringSelectMenuComponent(select);
  }

  // A subject has to fit an embed title and a log line, whatever the form says.
  const ceiling = field.kind === "subject" ? TICKET_SUBJECT_MAX : TICKET_FIELD_TEXT_MAX;
  const input = new TextInputBuilder()
    .setCustomId(field.id)
    .setStyle(field.style === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setRequired(field.required)
    .setMaxLength(Math.min(field.max_length ?? ceiling, ceiling));
  if (field.min_length) input.setMinLength(Math.min(field.min_length, ceiling));
  if (field.placeholder) input.setPlaceholder(field.placeholder);
  return label.setTextInputComponent(input);
}

/** Null when the category has nothing to ask: the ticket then opens straight away. */
export function buildTicketModal(
  category: TicketCategory,
  fields: TicketFormField[],
  products: TicketProduct[],
): ModalBuilder | null {
  const askable = askableFields(fields, products);
  if (askable.length === 0) return null;
  return new ModalBuilder()
    .setCustomId(ticketId(TICKET_IDS.submit, category.slug))
    .setTitle(category.name.slice(0, 45))
    .addLabelComponents(...askable.map((field) => fieldComponent(field, products)));
}

/** How a submitted form is read. `null` means the form didn't carry that field at all. */
export interface FormReader {
  text(fieldId: string): string | null;
  select(fieldId: string): string | null;
}

export interface TicketFormResult {
  subject: string;
  /** Empty when the form has no description field. */
  description: string;
  product: string | null;
  answers: TicketAnswerInput[];
}

/**
 * Turns a submitted form into a ticket. Returns "stale" when a required
 * question is missing from the submission: the form was edited in web-admin
 * while this member had it open, so they are asked to open it again.
 */
export function readTicketForm(
  category: TicketCategory,
  fields: TicketFormField[],
  products: TicketProduct[],
  reader: FormReader,
): TicketFormResult | "stale" {
  let subject = "";
  let description = "";
  let product: string | null = null;
  const answers: TicketAnswerInput[] = [];

  for (const field of askableFields(fields, products)) {
    const isSelect = field.kind === "product" || field.kind === "select";
    const raw = isSelect ? reader.select(field.id) : reader.text(field.id);
    if (raw === null) {
      if (field.required) return "stale";
      continue;
    }
    const value = raw.trim();

    if (field.kind === "subject") subject = value.slice(0, TICKET_SUBJECT_MAX);
    else if (field.kind === "description") description = value;
    // A product archived while the form was open is dropped rather than stored.
    else if (field.kind === "product") product = products.find((p) => p.slug === value)?.slug ?? null;
    else if (value) {
      const shown =
        field.kind === "select" ? (ticketSelectOptions(field).find((o) => o.value === value)?.label ?? value) : value;
      answers.push({ fieldId: field.id, label: field.label, value: shown });
    }
  }

  // A form without a subject files the ticket under the category's name.
  return { subject: subject || category.name, description, product, answers };
}

/**
 * What goes in the ticket row's description, which is never empty in practice:
 * the form's description, or the answers written out when it didn't ask for one.
 */
export function storedDescription(form: TicketFormResult): string {
  if (form.description) return form.description;
  return form.answers
    .map((answer) => `**${answer.label}**\n${answer.value}`)
    .join("\n\n")
    .slice(0, 4000);
}
