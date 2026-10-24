"use client";

import { useState } from "react";
import { FloatingMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { Plus } from "lucide-react";
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui";
import { BLOCKS, BLOCK_GROUP_LABELS, type BlockGroup, type BlockId } from "@/lib/cms/blocks";

// The way in for anyone who doesn't know the toolbar icons by heart: a "+"
// on every empty line, opening the same catalog a slash menu would show.

const GROUPS: BlockGroup[] = ["text", "structure", "media"];

/** Puts a block where the cursor is. Image and video need a dialog, so they are handed back. */
export function insertBlock(editor: Editor, id: BlockId, open: (dialog: "image" | "embed") => void) {
  const chain = editor.chain().focus();
  switch (id) {
    case "paragraph":
      return void chain.setParagraph().run();
    case "heading":
      return void chain.setHeading({ level: 2 }).run();
    case "subheading":
      return void chain.setHeading({ level: 3 }).run();
    case "smallHeading":
      return void chain.setHeading({ level: 4 }).run();
    case "bulletList":
      return void chain.toggleBulletList().run();
    case "orderedList":
      return void chain.toggleOrderedList().run();
    case "quote":
      return void chain.toggleBlockquote().run();
    case "note":
      return void chain.toggleWrap("callout", { variant: "info" }).run();
    case "tip":
      return void chain.toggleWrap("callout", { variant: "tip" }).run();
    case "warning":
      return void chain.toggleWrap("callout", { variant: "warning" }).run();
    case "codeBlock":
      return void chain.toggleCodeBlock().run();
    case "table":
      return void chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    case "divider":
      return void chain.setHorizontalRule().run();
    case "image":
    case "embed":
      return open(id);
  }
}

export function BlockInserter({ editor, onDialog }: { editor: Editor; onDialog: (dialog: "image" | "embed") => void }) {
  const [open, setOpen] = useState(false);

  return (
    <FloatingMenu
      editor={editor}
      // Only on a line with nothing on it: anywhere else it would sit on top
      // of the writing.
      shouldShow={({ editor: e, state }) => {
        const { $from, empty } = state.selection;
        return empty && e.isEditable && $from.parent.type.name === "paragraph" && $from.parent.content.size === 0;
      }}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 rounded-full border bg-background text-muted-foreground shadow-xs"
            aria-label="Add a block"
            title="Add a block"
          >
            <Plus className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command>
            <CommandInput placeholder="What do you want to add?" />
            <CommandList>
              <CommandEmpty>Nothing matches.</CommandEmpty>
              {GROUPS.map((group) => (
                <CommandGroup key={group} heading={BLOCK_GROUP_LABELS[group]}>
                  {BLOCKS.filter((block) => block.group === group).map((block) => (
                    <CommandItem
                      key={block.id}
                      value={`${block.label} ${block.keywords.join(" ")}`}
                      onSelect={() => {
                        setOpen(false);
                        insertBlock(editor, block.id, onDialog);
                      }}
                      className="flex-col items-start gap-0"
                    >
                      <span className="text-sm">{block.label}</span>
                      <span className="text-xs text-muted-foreground">{block.hint}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </FloatingMenu>
  );
}
