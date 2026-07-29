"use client";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@repo/ui";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Pencil,
  Trash2,
  Unlock,
} from "lucide-react";
import type { OverlayItem } from "@/types/overlays";
import { useOverlayStore } from "./use-overlay-store";

interface LayerContextMenuProps {
  item: OverlayItem;
  /** Called for "Rename" — layers panel starts inline editing; canvas focuses the inspector label. */
  onRename?: () => void;
  children: React.ReactNode;
}

/**
 * Shared right-click menu for canvas widgets and layer rows.
 * When the item is part of a multi-selection, Duplicate/Delete act on the whole
 * selection and single-item actions (rename, z-order, lock, visibility) are hidden.
 * No delete confirmation — undo (Ctrl+Z) covers it.
 */
export function LayerContextMenu({ item, onRename, children }: LayerContextMenuProps) {
  const {
    selectedItemIds,
    duplicateItem,
    duplicateSelectedItems,
    removeItem,
    removeSelectedItems,
    bringToFront,
    sendToBack,
    reorderItem,
    toggleItemLock,
    toggleItemVisibility,
  } = useOverlayStore();

  const isMulti =
    selectedItemIds.length > 1 && selectedItemIds.includes(item.id);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {!isMulti && onRename ? (
          <ContextMenuItem onSelect={() => onRename()}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Rename
          </ContextMenuItem>
        ) : null}
        <ContextMenuItem
          onSelect={() => (isMulti ? duplicateSelectedItems() : duplicateItem(item.id))}
        >
          <Copy className="mr-2 h-3.5 w-3.5" />
          Duplicate
          <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
        </ContextMenuItem>

        {!isMulti ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => bringToFront(item.id)}>
              <ArrowUpToLine className="mr-2 h-3.5 w-3.5" />
              Bring to front
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => reorderItem(item.id, "up")}>
              <ArrowUp className="mr-2 h-3.5 w-3.5" />
              Bring forward
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => reorderItem(item.id, "down")}>
              <ArrowDown className="mr-2 h-3.5 w-3.5" />
              Send backward
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => sendToBack(item.id)}>
              <ArrowDownToLine className="mr-2 h-3.5 w-3.5" />
              Send to back
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => toggleItemLock(item.id)}>
              {item.is_locked ? (
                <>
                  <Unlock className="mr-2 h-3.5 w-3.5" />
                  Unlock
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-3.5 w-3.5" />
                  Lock
                </>
              )}
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => toggleItemVisibility(item.id)}>
              {item.is_visible ? (
                <>
                  <EyeOff className="mr-2 h-3.5 w-3.5" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-3.5 w-3.5" />
                  Show
                </>
              )}
            </ContextMenuItem>
          </>
        ) : null}

        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onSelect={() => (isMulti ? removeSelectedItems() : removeItem(item.id))}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Delete
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
