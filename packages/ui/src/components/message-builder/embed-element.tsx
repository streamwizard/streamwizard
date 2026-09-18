"use client";

import { useRef, useState } from "react";
import { Columns2, PanelBottom } from "lucide-react";
import { DISCORD_LIMITS, type EmbedElement as Embed, type EmbedField, type VariableDefinition } from "@repo/discord-message";
import { cn } from "../../lib/utils";
import { ColorDot } from "./color-dot";
import { DISCORD, toHex } from "./discord-styles";
import { REVEAL } from "./element-shell";
import { EmbedFields } from "./embed-fields";
import { EmojiPicker } from "./emoji-picker";
import { InlineText, type Caret } from "./inline-text";
import { LinkMenu, type LinkDraft } from "./link-menu";
import { applyLink, findLinkAt, removeLink, type LinkAt, type TextRange } from "./links";
import { ToolbarButton } from "./toolbar-button";
import { VariableMenu } from "./variable-menu";

interface EmbedElementProps {
  embed: Embed;
  variables: VariableDefinition[];
  disabled?: boolean;
  onChange: (patch: Partial<Omit<Embed, "id" | "type">>) => void;
}

/** Which text the caret was last in: a top-level part, or one side of a field. */
type Target = { part: "title" | "description" | "footer" } | { part: "field"; fieldId: string; side: "name" | "value" };

/** Discord only renders masked links in the embed text and in field values. */
const takesLinks = (target: Target) => target.part === "description" || (target.part === "field" && target.side === "value");

export function EmbedElement({ embed, variables, disabled, onChange }: EmbedElementProps) {
  // Emoji and variables land where the caret last was. Opening their menu
  // blurs the text, so the spot is remembered on the way out.
  const last = useRef<{ target: Target; caret: Caret }>({ target: { part: "description" }, caret: { start: -1, end: -1 } });
  const remember = (target: Target) => (caret: Caret) => {
    last.current = { target, caret };
  };

  // An empty footer takes no room, as in Discord. The toolbar button opens it for typing.
  const [footerOpen, setFooterOpen] = useState(false);

  const setField = (fieldId: string, patch: Partial<Omit<EmbedField, "id">>) =>
    onChange({ fields: embed.fields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)) });

  const insert = (text: string) => {
    const { target, caret } = last.current;
    const splice = (value: string) => {
      const start = caret.start < 0 ? value.length : Math.min(caret.start, value.length);
      const end = caret.end < 0 ? value.length : Math.min(caret.end, value.length);
      last.current = { target, caret: { start: start + text.length, end: start + text.length } };
      return value.slice(0, start) + text + value.slice(end);
    };
    if (target.part !== "field") return onChange({ [target.part]: splice(embed[target.part]) });
    const field = embed.fields.find((f) => f.id === target.fieldId);
    if (!field) return onChange({ description: embed.description + text });
    setField(field.id, { [target.side]: splice(field[target.side]) });
  };

  const read = (target: Target) =>
    target.part === "field" ? (embed.fields.find((f) => f.id === target.fieldId)?.[target.side] ?? null) : embed[target.part];
  const write = (target: Target, value: string) =>
    target.part === "field" ? setField(target.fieldId, { [target.side]: value }) : onChange({ [target.part]: value });

  // The link menu works on the spot the caret left. `where` is kept from open
  // to submit: the words to replace, or the whole link being edited.
  const [linkDraft, setLinkDraft] = useState<LinkDraft | null>(null);
  const linkSpot = useRef<{ target: Target; where: TextRange | LinkAt } | null>(null);

  const openLink = () => {
    // From a title or footer the link goes at the end of the embed text.
    const target: Target = takesLinks(last.current.target) && read(last.current.target) !== null ? last.current.target : { part: "description" };
    const text = read(target) ?? "";
    const caret = target === last.current.target ? last.current.caret : { start: -1, end: -1 };
    const range = {
      start: caret.start < 0 ? text.length : Math.min(caret.start, text.length),
      end: caret.end < 0 ? text.length : Math.min(caret.end, text.length),
    };
    const existing = findLinkAt(text, range);
    linkSpot.current = { target, where: existing ?? range };
    setLinkDraft(
      existing
        ? { label: existing.label, url: existing.url, existing: true }
        : { label: text.slice(range.start, range.end).trim(), url: "", existing: false },
    );
  };

  const finishLink = (edit: (text: string, where: TextRange | LinkAt) => { text: string; caret: number }) => {
    const spot = linkSpot.current;
    const text = spot && read(spot.target);
    if (spot && typeof text === "string") {
      const next = edit(text, spot.where);
      last.current = { target: spot.target, caret: { start: next.caret, end: next.caret } };
      write(spot.target, next.text);
    }
    setLinkDraft(null);
  };

  // A new field follows the one before it, so a stacked list keeps stacking.
  const addField = () =>
    onChange({ fields: [...embed.fields, { id: crypto.randomUUID(), name: "", value: "", inline: embed.fields.at(-1)?.inline ?? true }] });

  return (
    <div
      className="relative max-w-[520px] rounded-[4px] border-l-4 py-2 pl-3 pr-4 text-sm"
      style={{ backgroundColor: DISCORD.embed, borderLeftColor: toHex(embed.color), color: DISCORD.text }}
    >
      <div className={cn("absolute -top-4 right-2 z-[1] flex items-center gap-1", REVEAL)}>
        <EmojiPicker onPick={insert} disabled={disabled} />
        <VariableMenu variables={variables} onPick={insert} disabled={disabled} />
        <LinkMenu
          draft={linkDraft}
          onOpen={openLink}
          onClose={() => setLinkDraft(null)}
          onSubmit={(label, url) => finishLink((text, where) => applyLink(text, where, label, url))}
          onRemove={() => finishLink((text, where) => ("url" in where ? removeLink(text, where) : { text, caret: where.end }))}
          disabled={disabled}
        />
        <ToolbarButton
          label={embed.fields.length >= DISCORD_LIMITS.embedFields ? "Discord allows 25 fields" : "Add a field"}
          disabled={disabled || embed.fields.length >= DISCORD_LIMITS.embedFields}
          onClick={addField}
        >
          <Columns2 />
        </ToolbarButton>
        {!embed.footer && !footerOpen && (
          <ToolbarButton label="Add a footer" disabled={disabled} onClick={() => setFooterOpen(true)}>
            <PanelBottom />
          </ToolbarButton>
        )}
        <ColorDot color={embed.color} onChange={(color) => onChange({ color })} disabled={disabled} />
      </div>

      <InlineText
        value={embed.title}
        onChange={(title) => onChange({ title })}
        onCaret={remember({ part: "title" })}
        variables={variables}
        placeholder="Title"
        aria-label="Embed title"
        disabled={disabled}
        className="mt-1 text-base font-semibold leading-[1.375] text-[#f2f3f5]"
      />
      <InlineText
        value={embed.description}
        onChange={(description) => onChange({ description })}
        onCaret={remember({ part: "description" })}
        variables={variables}
        placeholder="Write something here"
        aria-label="Embed text"
        onLinkShortcut={openLink}
        multiline
        disabled={disabled}
        className="mt-1 leading-[1.375]"
      />

      {embed.fields.length > 0 && (
        <EmbedFields fields={embed.fields} disabled={disabled} onChange={(fields) => onChange({ fields })}>
          {(field) => (
            <>
              <InlineText
                value={field.name}
                onChange={(name) => setField(field.id, { name })}
                onCaret={remember({ part: "field", fieldId: field.id, side: "name" })}
                variables={variables}
                placeholder="Field name"
                aria-label="Field name"
                disabled={disabled}
                className="pr-14 font-semibold leading-[1.375] text-[#f2f3f5]"
              />
              <InlineText
                value={field.value}
                onChange={(value) => setField(field.id, { value })}
                onCaret={remember({ part: "field", fieldId: field.id, side: "value" })}
                variables={variables}
                placeholder="Field value"
                aria-label="Field value"
                onLinkShortcut={openLink}
                multiline
                disabled={disabled}
                className="leading-[1.375]"
              />
            </>
          )}
        </EmbedFields>
      )}

      {(embed.footer || footerOpen) && (
        <InlineText
          value={embed.footer}
          onChange={(footer) => onChange({ footer })}
          onCaret={(caret) => {
            remember({ part: "footer" })(caret);
            setFooterOpen(false);
          }}
          variables={variables}
          placeholder="Footer text"
          aria-label="Embed footer"
          startEditing={footerOpen}
          disabled={disabled}
          className="mt-2 text-xs leading-4 text-[#dbdee1]"
        />
      )}
    </div>
  );
}
