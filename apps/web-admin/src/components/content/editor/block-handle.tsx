"use client";

import { useState } from "react";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import type { Editor } from "@tiptap/react";
import { ArrowDown, ArrowUp, Copy, GripVertical, Trash2 } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui";

// A grip beside the block the pointer is over. Dragging reorders; the menu
// does the same thing from the keyboard, because a drag-only control can't
// be used without a mouse.

/** Moves the block at `pos` one place up or down among its siblings. */
function moveBlock(editor: Editor, pos: number, direction: -1 | 1): boolean {
  const { doc } = editor.state;
  const resolved = doc.resolve(pos);
  const parent = resolved.parent;
  const index = resolved.index();
  const target = index + direction;
  if (target < 0 || target >= parent.childCount) return false;

  const node = parent.child(index);
  const neighbour = parent.child(target);
  const from = pos;
  const to = pos + node.nodeSize;
  // Cut the block out, then put it back on the far side of its neighbour.
  const insertAt = direction === -1 ? from - neighbour.nodeSize : from + neighbour.nodeSize;
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.delete(from, to);
      tr.insert(tr.mapping.map(insertAt, -1), node);
      return true;
    })
    .run();
  return true;
}

export function BlockHandle({ editor }: { editor: Editor }) {
  const [current, setCurrent] = useState<{ pos: number; size: number } | null>(null);
  const [open, setOpen] = useState(false);

  const act = (run: () => void) => {
    setOpen(false);
    run();
  };

  return (
    <DragHandle
      editor={editor}
      className="pr-1"
      onNodeChange={({ node, pos }) => setCurrent(node ? { pos, size: node.nodeSize } : null)}
    >
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 cursor-grab text-muted-foreground active:cursor-grabbing"
            aria-label="Move this block, or open its menu"
          >
            <GripVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem
            disabled={!current}
            onSelect={() => act(() => current && moveBlock(editor, current.pos, -1))}
          >
            <ArrowUp aria-hidden />
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!current}
            onSelect={() => act(() => current && moveBlock(editor, current.pos, 1))}
          >
            <ArrowDown aria-hidden />
            Move down
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!current}
            onSelect={() =>
              act(() => {
                if (!current) return;
                const node = editor.state.doc.nodeAt(current.pos);
                if (node) editor.chain().focus().insertContentAt(current.pos + node.nodeSize, node.toJSON()).run();
              })
            }
          >
            <Copy aria-hidden />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={!current}
            onSelect={() =>
              act(() => {
                if (!current) return;
                editor
                  .chain()
                  .focus()
                  .deleteRange({ from: current.pos, to: current.pos + current.size })
                  .run();
              })
            }
          >
            <Trash2 aria-hidden />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </DragHandle>
  );
}
