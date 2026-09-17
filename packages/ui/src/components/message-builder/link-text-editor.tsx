"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { cn } from "../../lib/utils";
import { DISCORD } from "./discord-styles";
import { pasteAsLink, splitLinks } from "./links";

// The text box for parts that take links. A link stays blue text while you
// type around it, as in the preview; the [text](address) form never shows.
// Click a link to change it.
//
// The DOM is ours, not React's: text nodes, line breaks, and one span per
// link whose text is the label. It is read back into the raw text on every
// input. The spans stay editable: next to a non-editable one, browsers can't
// put a caret on an empty line and delete more than was asked.

interface Caret {
  start: number;
  end: number;
}

interface LinkTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  "aria-label": string;
  multiline: boolean;
  className?: string;
  /** Where the click that opened the box landed, so the caret starts there instead of at the end. */
  startAt?: { x: number; y: number } | null;
  /** Focus left, or Enter closed the box. `caret` is in raw-text offsets. */
  onDone: (caret: Caret) => void;
  onCancel: () => void;
  /** A link was clicked, or Ctrl+K pressed. `caret` sits in the link or on the selection. */
  onLink: (caret: Caret) => void;
}

const isLink = (node: Node): node is HTMLElement => node instanceof HTMLElement && node.dataset.url !== undefined;
// What a label can't hold without the link falling apart.
const linkLabel = (el: HTMLElement) => (el.textContent ?? "").replace(/[[\]\n]/g, "");
/** A link typed down to nothing is gone. */
const linkRaw = (el: HTMLElement) => (linkLabel(el) ? `[${linkLabel(el)}](${el.dataset.url ?? ""})` : "");

function build(root: HTMLElement, text: string) {
  const nodes = splitLinks(text).map((segment) => {
    if (segment.type === "text") return document.createTextNode(segment.value);
    const el = document.createElement("span");
    el.dataset.url = segment.url;
    el.textContent = segment.label;
    el.title = `${segment.url}\nClick to change`;
    el.style.color = DISCORD.link;
    el.className = "cursor-pointer rounded-sm hover:underline";
    return el;
  });
  // A last line break only shows with something after it. Chrome keeps a second "\n" there itself.
  if (text.endsWith("\n")) nodes.push(document.createTextNode("\n"));
  root.replaceChildren(...nodes);
}

function read(node: Node): string {
  let out = "";
  for (const child of node.childNodes) {
    if (child instanceof Text) out += child.data;
    else if (isLink(child)) out += linkRaw(child);
    else if (child instanceof HTMLBRElement) out += "\n";
    else {
      // A browser that wraps lines in blocks instead of using line breaks.
      if (out && !out.endsWith("\n")) out += "\n";
      out += read(child);
    }
  }
  return out;
}

/** The last line break is the browser's stand-in that makes the empty last line show, not one the admin typed. */
function readRoot(root: HTMLElement): string {
  const text = read(root);
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}

const rawLength = (node: Node): number =>
  node instanceof Text ? node.data.length : isLink(node) ? linkRaw(node).length : node instanceof HTMLBRElement ? 1 : read(node).length;

/** A DOM position as an offset into the raw text. */
function toOffset(root: HTMLElement, container: Node, offset: number): number {
  let total = 0;
  const walk = (node: Node): boolean => {
    if (isLink(node)) {
      if (!node.contains(container)) {
        total += rawLength(node);
        return false;
      }
      // Inside the label, which starts after the "[".
      const before = document.createRange();
      before.setStart(node, 0);
      before.setEnd(container, offset);
      total += 1 + before.toString().length;
      return true;
    }
    if (node === container) {
      if (node instanceof Text) total += offset;
      else for (const child of [...node.childNodes].slice(0, offset)) total += rawLength(child);
      return true;
    }
    if (node.childNodes.length === 0) {
      total += rawLength(node);
      return false;
    }
    for (const child of node.childNodes) if (walk(child)) return true;
    return false;
  };
  walk(root);
  return total;
}

/** The selection in raw-text offsets, or null when it isn't inside the box. */
function selectionIn(root: HTMLElement): Caret | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const length = readRoot(root).length;
  return {
    start: Math.min(toOffset(root, range.startContainer, range.startOffset), length),
    end: Math.min(toOffset(root, range.endContainer, range.endOffset), length),
  };
}

/** The link whose first or last position the collapsed caret is on. Typing there belongs outside the link. */
function linkEdge(root: HTMLElement): { link: HTMLElement; side: "before" | "after" } | null {
  const selection = window.getSelection();
  if (!selection || !selection.isCollapsed || selection.rangeCount === 0) return null;
  const { startContainer, startOffset } = selection.getRangeAt(0);
  if (startContainer === root) {
    // Between nodes: beside a link still counts, or the browser types into it.
    const [left, right] = [root.childNodes[startOffset - 1], root.childNodes[startOffset]];
    if (left && isLink(left)) return { link: left, side: "after" };
    return right && isLink(right) ? { link: right, side: "before" } : null;
  }
  const link = [...root.children].find((child): child is HTMLElement => isLink(child) && child.contains(startContainer));
  if (!link) return null;
  const before = document.createRange();
  before.setStart(link, 0);
  before.setEnd(startContainer, startOffset);
  const at = before.toString().length;
  if (at === 0) return { link, side: "before" };
  return at >= (link.textContent ?? "").length ? { link, side: "after" } : null;
}

function selectionStartsInLink(root: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  const start = selection.getRangeAt(0).startContainer;
  return [...root.children].some((child) => isLink(child) && child.contains(start));
}

function typeOutside(root: HTMLElement, { link, side }: { link: HTMLElement; side: "before" | "after" }, data: string) {
  const range = document.createRange();
  if (side === "before") {
    const node = link.previousSibling instanceof Text ? link.previousSibling : link.parentNode!.insertBefore(document.createTextNode(""), link);
    node.appendData(data);
    range.setStart(node, node.data.length);
  } else {
    const node = link.nextSibling instanceof Text ? link.nextSibling : link.parentNode!.insertBefore(document.createTextNode(""), link.nextSibling);
    node.insertData(0, data);
    // A line break at the very end needs its stand-in to show.
    if (node === root.lastChild && node.data === "\n") node.appendData("\n");
    range.setStart(node, data.length);
  }
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function placeCaretAtPoint(root: HTMLElement, { x, y }: { x: number; y: number }): boolean {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const position = doc.caretPositionFromPoint?.(x, y);
  const range = position ? document.createRange() : (doc.caretRangeFromPoint?.(x, y) ?? null);
  if (!range) return false;
  if (position) range.setStart(position.offsetNode, position.offset);
  if (!root.contains(range.startContainer)) return false;
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return true;
}

function placeCaret(root: HTMLElement, offset: number | "end") {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  if (offset !== "end") {
    let left = offset;
    for (const child of root.childNodes) {
      const length = rawLength(child);
      if (child instanceof Text && left <= length) {
        range.setStart(child, left);
        range.collapse(true);
        break;
      }
      const label = isLink(child) ? child.firstChild : null;
      if (label instanceof Text && left > 0 && left < length) {
        range.setStart(label, Math.min(left - 1, label.data.length));
        range.collapse(true);
        break;
      }
      left -= length;
      if (left <= 0) {
        range.setStartAfter(child);
        range.collapse(true);
        break;
      }
    }
  }
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function LinkTextEditor({ value, onChange, placeholder, multiline, className, startAt, onDone, onCancel, onLink, ...aria }: LinkTextEditorProps) {
  const root = useRef<HTMLDivElement>(null);
  // What the DOM holds right now, as raw text. A `value` that differs came from outside and is drawn again.
  const shown = useRef<string | null>(null);
  const caret = useRef<Caret>({ start: -1, end: -1 });
  const caretAfter = useRef<number | "end">("end");
  const point = useRef(startAt ?? null);
  // Set once the box is on its way out, so the blur that follows doesn't report twice.
  const closed = useRef(false);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || shown.current === value) return;
    build(el, value);
    shown.current = value;
    el.focus();
    if (!point.current || !placeCaretAtPoint(el, point.current)) placeCaret(el, caretAfter.current);
    point.current = null;
    caretAfter.current = "end";
  }, [value]);

  /** Where the selection is now, or where it last was inside the box. */
  const readCaret = (): Caret => {
    const now = root.current && selectionIn(root.current);
    if (now) caret.current = now;
    return caret.current;
  };

  // By the time focus leaves, the selection may have left too, so it is followed as it moves.
  useEffect(() => {
    const follow = () => {
      const now = root.current && selectionIn(root.current);
      if (now) caret.current = now;
    };
    document.addEventListener("selectionchange", follow);
    return () => document.removeEventListener("selectionchange", follow);
  }, []);

  const emit = () => {
    const el = root.current;
    if (!el) return;
    let text = readRoot(el);
    if (!multiline) text = text.replace(/\n/g, " ");
    for (const child of [...el.children]) if (isLink(child) && !linkLabel(child)) child.remove();
    // Left empty, browsers keep a stray <br> that would hide the placeholder.
    if (text === "") el.replaceChildren();
    shown.current = text;
    onChange(text);
  };

  // Typing on the first or last position of a link lands outside it, so a
  // link never grows by accident and a line can start with one.
  const live = useRef({ emit, multiline });
  useEffect(() => {
    live.current = { emit, multiline };
  });
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onBeforeInput = (e: InputEvent) => {
      if (e.isComposing) return;
      const typed =
        e.inputType === "insertText"
          ? e.data
          : e.inputType === "insertLineBreak" || e.inputType === "insertParagraph"
            ? "\n"
            : e.inputType === "insertFromPaste"
              ? (e.dataTransfer?.getData("text/plain") ?? null)
              : null;
      if (!typed) return;
      const edge = linkEdge(el);
      if (edge) {
        e.preventDefault();
        typeOutside(el, edge, live.current.multiline ? typed : typed.replace(/\n/g, " "));
        live.current.emit();
      } else if (typed.includes("\n") && selectionStartsInLink(el)) {
        // A line break inside a label would cut the link in two.
        e.preventDefault();
      }
    };
    el.addEventListener("beforeinput", onBeforeInput);
    return () => el.removeEventListener("beforeinput", onBeforeInput);
  }, []);

  const close = (then: () => void) => {
    closed.current = true;
    then();
  };

  return (
    <div
      ref={root}
      role="textbox"
      aria-label={aria["aria-label"]}
      aria-multiline={multiline}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder}
      onInput={emit}
      onBlur={() => !closed.current && close(() => onDone(readCaret()))}
      onMouseDown={(e) => {
        const link = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-url]") : null;
        if (!link || !root.current) return;
        e.preventDefault();
        const start = toOffset(root.current, link, 0);
        close(() => onLink({ start: start + 1, end: start + 1 }));
      }}
      onPaste={(e) => {
        const linked = pasteAsLink(value, readCaret(), e.clipboardData.getData("text/plain"));
        if (!linked) return;
        e.preventDefault();
        caretAfter.current = linked.caret;
        onChange(linked.text);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close(onCancel);
        } else if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          close(() => onLink(readCaret()));
        } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          close(() => onDone(readCaret()));
        }
      }}
      className={cn(
        "block min-h-[1.375em] w-full cursor-text whitespace-pre-wrap break-words rounded-sm bg-black/25 outline-none ring-1 ring-[#5865f2]",
        "empty:before:pointer-events-none empty:before:text-[#949ba4]/70 empty:before:content-[attr(data-placeholder)]",
        className,
      )}
    />
  );
}
