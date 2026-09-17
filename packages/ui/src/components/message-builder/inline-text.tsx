"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { VariableDefinition } from "@repo/discord-message";
import { cn } from "../../lib/utils";
import { LinkTextEditor } from "./link-text-editor";
import { findLinks } from "./links";
import { RichTextView } from "./rich-text-view";

export interface Caret {
  start: number;
  end: number;
}

interface InlineTextProps {
  value: string;
  onChange: (value: string) => void;
  variables: VariableDefinition[];
  placeholder: string;
  "aria-label": string;
  multiline?: boolean;
  disabled?: boolean;
  /** Typography shared by the read and edit states, so switching doesn't shift the layout. */
  className?: string;
  /** Open ready to type, for parts that only appear once asked for (a footer). */
  startEditing?: boolean;
  /** Reports where the caret was when focus left, so a toolbar can insert there. */
  onCaret?: (caret: Caret) => void;
  /**
   * Discord renders masked links here (embed text and field values, not titles
   * or footers). Links stay one blue piece while editing; clicking one, or
   * Ctrl+K, asks for the link menu after the caret is reported. Pasting an
   * address over selected words links them.
   */
  onLinkShortcut?: () => void;
}

/**
 * Text that is edited where it stands. Reads as Discord would render it, with
 * placeholders as chips; click it and it becomes a text box holding the raw
 * text. Edits apply as you type, Escape puts back what was there.
 */
export function InlineText({
  value,
  onChange,
  variables,
  placeholder,
  multiline = false,
  disabled = false,
  className,
  startEditing = false,
  onCaret,
  onLinkShortcut,
  ...aria
}: InlineTextProps) {
  const [editing, setEditing] = useState(startEditing);
  const before = useRef(value);
  const box = useRef<HTMLTextAreaElement>(null);

  // Grow with the text. A textarea for single lines too, so both states wrap the same way.
  useLayoutEffect(() => {
    const el = box.current;
    if (!editing || !el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [editing, value]);

  // Where the opening click landed. Focus comes first and has no position; the click that follows fills it in.
  const [clickedAt, setClickedAt] = useState<{ x: number; y: number } | null>(null);

  const start = (at: { x: number; y: number } | null = null) => {
    if (disabled) return;
    before.current = value;
    setClickedAt(at);
    setEditing(true);
  };

  const openLink = (caret: Caret) => {
    onCaret?.(caret);
    setEditing(false);
    onLinkShortcut?.();
  };

  if (editing && onLinkShortcut) {
    return (
      <LinkTextEditor
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={aria["aria-label"]}
        multiline={multiline}
        className={className}
        startAt={clickedAt}
        onDone={(caret) => {
          onCaret?.(caret);
          setEditing(false);
        }}
        onCancel={() => {
          onChange(before.current);
          setEditing(false);
        }}
        onLink={openLink}
      />
    );
  }

  if (editing) {
    return (
      <textarea
        ref={box}
        autoFocus
        rows={1}
        value={value}
        placeholder={placeholder}
        aria-label={aria["aria-label"]}
        onChange={(e) => onChange(multiline ? e.target.value : e.target.value.replace(/\n/g, " "))}
        onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
        onBlur={(e) => {
          onCaret?.({ start: e.target.selectionStart, end: e.target.selectionEnd });
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onChange(before.current);
            setEditing(false);
          } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        className={cn(
          "block w-full resize-none overflow-hidden rounded-sm bg-black/25 outline-none ring-1 ring-[#5865f2] placeholder:text-[#949ba4]/70",
          className,
        )}
      />
    );
  }

  return (
    <div
      role="textbox"
      tabIndex={disabled ? -1 : 0}
      aria-label={aria["aria-label"]}
      aria-readonly={disabled}
      onMouseDown={(e) => {
        // Open from here, not from the focus that follows, so the caret can go where the click was.
        if (disabled || !onLinkShortcut) return;
        e.preventDefault();
        start({ x: e.clientX, y: e.clientY });
      }}
      onClick={() => start()}
      onFocus={() => start()}
      className={cn(
        "min-h-[1.375em] cursor-text whitespace-pre-wrap break-words rounded-sm outline-none hover:bg-white/5",
        !value && "text-[#949ba4]/70 italic",
        className,
      )}
    >
      {value ? (
        <RichTextView
          text={value}
          variables={variables}
          onLinkClick={
            onLinkShortcut && !disabled
              ? (index) => {
                  const link = findLinks(value)[index];
                  if (link) openLink({ start: link.start + 1, end: link.start + 1 });
                }
              : undefined
          }
        />
      ) : (
        placeholder
      )}
    </div>
  );
}
