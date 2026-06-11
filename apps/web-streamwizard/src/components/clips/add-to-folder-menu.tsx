"use client";

import type { ClipFolderNode } from "@/lib/utils/clip-folders";
import {
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@repo/ui";
import { Folder } from "lucide-react";

type AddToFolderItemsProps = {
  /** Folder tree to render (build with buildClipFolderTree). */
  nodes: ClipFolderNode[];
  /** Folder ids the clip already belongs to — their add action is disabled. */
  assignedIds: number[];
  onAdd: (folder: ClipFolderNode) => void;
  /**
   * Extra props spread onto every DropdownMenuSubContent. The clip card uses
   * this to stop menu interactions from bubbling up and opening the clip.
   */
  surfaceProps?: React.ComponentProps<typeof DropdownMenuSubContent>;
};

/**
 * Recursive "add to folder" menu. Folders with subfolders open a nested
 * submenu (waterfall); the first entry of each submenu lets you add the clip
 * to that parent folder directly.
 */
export function AddToFolderItems({ nodes, assignedIds, onAdd, surfaceProps }: AddToFolderItemsProps) {
  return (
    <>
      {nodes.map((node) => {
        const isAssigned = assignedIds.includes(node.id);

        if (node.children.length > 0) {
          return (
            <DropdownMenuSub key={node.id}>
              <DropdownMenuSubTrigger>
                <Folder className="mr-2 size-4 text-muted-foreground" />
                {node.name}
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent {...surfaceProps}>
                  <DropdownMenuItem disabled={isAssigned} onClick={() => onAdd(node)}>
                    {isAssigned ? `Already in ${node.name}` : `Add to ${node.name}`}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <AddToFolderItems
                    nodes={node.children}
                    assignedIds={assignedIds}
                    onAdd={onAdd}
                    surfaceProps={surfaceProps}
                  />
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          );
        }

        return (
          <DropdownMenuItem key={node.id} disabled={isAssigned} onClick={() => onAdd(node)}>
            <Folder className="mr-2 size-4 text-muted-foreground" />
            {node.name}
          </DropdownMenuItem>
        );
      })}
    </>
  );
}
