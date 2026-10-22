"use client";

import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { BLOCKS, matchBlocks, type BlockId, type BlockOption } from "@/lib/cms/blocks";
import { cn } from "@/lib/utils";

// "/" opens the same catalog the "+" button shows, without leaving the
// keyboard. The "+" is how it is found; this is how it is used once it's
// known, so both read from lib/cms/blocks and neither can list a block the
// other doesn't have.

const MAX_SHOWN = 8;

export interface SlashMenuState {
  items: BlockOption[];
  /** Which item Enter would pick. */
  index: number;
  /** Where the "/" is on screen, so the list can sit under it. */
  rect: DOMRect | null;
}

export interface SlashMenuOptions {
  onChange: (state: SlashMenuState | null) => void;
  onPick: (editor: Editor, id: BlockId) => void;
}

export const SlashMenu = Extension.create<SlashMenuOptions>({
  name: "cmsSlashMenu",

  addOptions() {
    return { onChange: () => {}, onPick: () => {} };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      Suggestion<BlockOption, { id: BlockId }>({
        editor: this.editor,
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }) => matchBlocks(query, BLOCKS).slice(0, MAX_SHOWN),
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run();
          options.onPick(editor, props.id);
        },
        render: () => {
          let items: BlockOption[] = [];
          let index = 0;
          let rect: (() => DOMRect | null) | null = null;
          let run: ((item: BlockOption) => void) | null = null;

          const emit = () =>
            options.onChange(items.length > 0 ? { items, index, rect: rect?.() ?? null } : null);

          return {
            onStart: (props) => {
              items = props.items;
              index = 0;
              rect = props.clientRect ?? null;
              run = props.command;
              emit();
            },
            onUpdate: (props) => {
              items = props.items;
              index = Math.min(index, Math.max(items.length - 1, 0));
              rect = props.clientRect ?? null;
              run = props.command;
              emit();
            },
            onKeyDown: ({ event }) => {
              if (items.length === 0) return false;
              if (event.key === "ArrowDown") {
                index = (index + 1) % items.length;
                emit();
                return true;
              }
              if (event.key === "ArrowUp") {
                index = (index - 1 + items.length) % items.length;
                emit();
                return true;
              }
              if (event.key === "Enter" || event.key === "Tab") {
                const item = items[index];
                if (!item || !run) return false;
                run(item);
                return true;
              }
              if (event.key === "Escape") {
                options.onChange(null);
                return true;
              }
              return false;
            },
            onExit: () => {
              items = [];
              run = null;
              options.onChange(null);
            },
          };
        },
      }),
    ];
  },
});

/** The list itself: plain absolute positioning, no popup library. */
export function SlashMenuList({ state, onPick }: { state: SlashMenuState; onPick: (item: BlockOption) => void }) {
  if (!state.rect) return null;
  return (
    <div
      role="listbox"
      aria-label="Add a block"
      className="fixed z-50 w-64 overflow-hidden rounded-lg border bg-popover p-1 shadow-md"
      style={{ top: state.rect.bottom + 6, left: state.rect.left }}
    >
      {state.items.map((item, position) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={position === state.index}
          // The caret stays in the editor: the click must not take focus.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(item)}
          className={cn(
            "flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left",
            position === state.index && "bg-muted",
          )}
        >
          <span className="text-sm">{item.label}</span>
          <span className="text-xs text-muted-foreground">{item.hint}</span>
        </button>
      ))}
    </div>
  );
}
