"use client";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
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
  FolderInput,
  FolderOutput,
  Group,
  Lock,
  Pencil,
  Trash2,
  Ungroup,
  Unlock,
} from "lucide-react";
import type { OverlayItem, OverlayItemGroup } from "@/types/overlays";
import { asClipDisplayFieldConfig, isRootOverlayItemType } from "@/types/overlays";
import { useOverlayStore } from "@/stores/overlay-editor-store";
import {
  groupItemIds,
  indexGroups,
  moveTargets,
  selectedGroupId,
  selectionNodes,
  type LayerNode,
} from "./item-groups";

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
    scene,
    selectedItemIds,
    groupSelected,
    ungroupSelected,
    setRenameRequestId,
    setSelectedItems,
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
  const items = scene?.items ?? [];
  const groups = scene?.groups ?? [];

  // Right-clicking a member of a selected group is right-clicking the group.
  const wholeGroupId =
    selectedItemIds.includes(item.id) && selectedGroupId(selectedItemIds, items, groups);
  if (wholeGroupId) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          <GroupMenuItems groupId={wholeGroupId} onRename={() => setRenameRequestId(wholeGroupId)} />
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  const selection = selectedItemIds.includes(item.id) ? selectedItemIds : [item.id];
  const hasGroupInSelection = selectionNodes(selection, items, groups).some(
    (n) => n.kind === "group"
  );
  const groupable = isRootOverlayItemType(item.type);
  // A layers row can be right-clicked without being selected; group what was clicked.
  const onSelection = (action: () => void) => () => {
    if (!selectedItemIds.includes(item.id)) setSelectedItems([item.id]);
    action();
  };

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

        {groupable ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={onSelection(groupSelected)}>
              <Group className="mr-2 h-3.5 w-3.5" />
              {isMulti ? "Group selection" : "Group"}
              <ContextMenuShortcut>Ctrl+G</ContextMenuShortcut>
            </ContextMenuItem>
            {hasGroupInSelection ? (
              <ContextMenuItem onSelect={onSelection(ungroupSelected)}>
                <Ungroup className="mr-2 h-3.5 w-3.5" />
                Ungroup
                <ContextMenuShortcut>Ctrl+Shift+G</ContextMenuShortcut>
              </ContextMenuItem>
            ) : null}
            {!isMulti ? <MoveToGroupItems node={{ kind: "item", id: item.id }} /> : null}
          </>
        ) : null}

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

/**
 * "Move to group" and "Remove from group" for one item or group. Moving a
 * group into its own subtree isn't offered.
 */
function MoveToGroupItems({ node }: { node: LayerNode }) {
  const { scene, moveNodeToGroup } = useOverlayStore();
  if (!scene) return null;
  const items = scene.items;
  const groups = scene.groups ?? [];
  const targets = moveTargets(node, items, groups);
  const index = indexGroups(groups);
  const inGroup =
    node.kind === "item"
      ? !!items.find((i) => i.id === node.id)?.group_id
      : !!index.get(node.id)?.parent_group_id;

  return (
    <>
      {targets.length > 0 ? (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <FolderInput className="mr-2 h-3.5 w-3.5" />
            Move to group
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48 max-h-72 overflow-y-auto">
            {targets.map((g) => (
              <ContextMenuItem key={g.id} onSelect={() => moveNodeToGroup(node, g.id)}>
                <span className="truncate">{g.label}</span>
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      ) : null}
      {inGroup ? (
        <ContextMenuItem onSelect={() => moveNodeToGroup(node, null)}>
          <FolderOutput className="mr-2 h-3.5 w-3.5" />
          Remove from group
        </ContextMenuItem>
      ) : null}
    </>
  );
}

/**
 * Everything a group can do. Shared by the group's layers row and by a
 * right-click on the canvas while the whole group is selected.
 */
function GroupMenuItems({ groupId, onRename }: { groupId: string; onRename?: () => void }) {
  const {
    scene,
    selectNode,
    duplicateSelectedItems,
    removeSelectedItems,
    ungroupSelected,
    reorderNode,
    toggleGroupLock,
    toggleGroupVisibility,
  } = useOverlayStore();
  if (!scene) return null;

  const node: LayerNode = { kind: "group", id: groupId };
  const members = new Set(groupItemIds(groupId, scene.items, indexGroups(scene.groups ?? [])));
  const memberItems = scene.items.filter((i) => members.has(i.id));
  const allLocked = memberItems.length > 0 && memberItems.every((i) => i.is_locked);
  const allHidden = memberItems.length > 0 && memberItems.every((i) => !i.is_visible);
  // Selection-based actions act on the group, whatever was selected before.
  const withGroupSelected = (action: () => void) => () => {
    selectNode(node);
    action();
  };

  return (
    <>
      {onRename ? (
        <ContextMenuItem onSelect={() => onRename()}>
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Rename
        </ContextMenuItem>
      ) : null}
      <ContextMenuItem onSelect={withGroupSelected(duplicateSelectedItems)}>
        <Copy className="mr-2 h-3.5 w-3.5" />
        Duplicate
        <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onSelect={withGroupSelected(ungroupSelected)}>
        <Ungroup className="mr-2 h-3.5 w-3.5" />
        Ungroup
        <ContextMenuShortcut>Ctrl+Shift+G</ContextMenuShortcut>
      </ContextMenuItem>
      <MoveToGroupItems node={node} />

      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => reorderNode(node, "front")}>
        <ArrowUpToLine className="mr-2 h-3.5 w-3.5" />
        Bring to front
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => reorderNode(node, "up")}>
        <ArrowUp className="mr-2 h-3.5 w-3.5" />
        Bring forward
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => reorderNode(node, "down")}>
        <ArrowDown className="mr-2 h-3.5 w-3.5" />
        Send backward
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => reorderNode(node, "back")}>
        <ArrowDownToLine className="mr-2 h-3.5 w-3.5" />
        Send to back
      </ContextMenuItem>

      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => toggleGroupLock(groupId)}>
        {allLocked ? (
          <>
            <Unlock className="mr-2 h-3.5 w-3.5" />
            Unlock all
          </>
        ) : (
          <>
            <Lock className="mr-2 h-3.5 w-3.5" />
            Lock all
          </>
        )}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => toggleGroupVisibility(groupId)}>
        {allHidden ? (
          <>
            <Eye className="mr-2 h-3.5 w-3.5" />
            Show all
          </>
        ) : (
          <>
            <EyeOff className="mr-2 h-3.5 w-3.5" />
            Hide all
          </>
        )}
      </ContextMenuItem>

      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onSelect={withGroupSelected(removeSelectedItems)}>
        <Trash2 className="mr-2 h-3.5 w-3.5" />
        Delete group
        <ContextMenuShortcut>Del</ContextMenuShortcut>
      </ContextMenuItem>
    </>
  );
}

interface GroupContextMenuProps {
  group: OverlayItemGroup;
  /** Starts inline renaming on the layers row. */
  onRename: () => void;
  children: React.ReactNode;
}

/** Right-click menu for a group's row in the layers panel. */
export function GroupContextMenu({ group, onRename, children }: GroupContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <GroupMenuItems groupId={group.id} onRename={onRename} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface ClipFieldContextMenuProps {
  field: OverlayItem;
  /** Sibling fields, front to back, as the layers panel lists them. */
  siblings: OverlayItem[];
  children: React.ReactNode;
}

/**
 * Right-click menu for a clip display field row. These never leave their
 * clips widget, so there is no rename, duplicate or delete: only stacking
 * order, plus the same show/lock toggles the row itself carries.
 */
export function ClipFieldContextMenu({
  field,
  siblings,
  children,
}: ClipFieldContextMenuProps) {
  const { updateItem, toggleItemVisibility, selectedItemIds, selectItem } =
    useOverlayStore();

  const fc = asClipDisplayFieldConfig(field.config);
  const index = siblings.findIndex((s) => s.id === field.id);
  const above = index > 0 ? siblings[index - 1] : undefined;
  const below =
    index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : undefined;

  const swapStack = (other: OverlayItem) => {
    const o = asClipDisplayFieldConfig(other.config);
    updateItem(field.id, { config: { ...fc, stackOrder: o.stackOrder } });
    updateItem(other.id, { config: { ...o, stackOrder: fc.stackOrder } });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem disabled={!above} onSelect={() => above && swapStack(above)}>
          <ArrowUp className="mr-2 h-3.5 w-3.5" />
          Bring forward
        </ContextMenuItem>
        <ContextMenuItem disabled={!below} onSelect={() => below && swapStack(below)}>
          <ArrowDown className="mr-2 h-3.5 w-3.5" />
          Send backward
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() =>
            updateItem(field.id, {
              config: { ...fc, isLayoutLocked: !fc.isLayoutLocked },
            })
          }
        >
          {fc.isLayoutLocked ? (
            <>
              <Unlock className="mr-2 h-3.5 w-3.5" />
              Unlock in editor
            </>
          ) : (
            <>
              <Lock className="mr-2 h-3.5 w-3.5" />
              Lock position &amp; size
            </>
          )}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            toggleItemVisibility(field.id);
            // A field that just went hidden should not stay the selection.
            if (field.is_visible && selectedItemIds.includes(field.id)) {
              selectItem(fc.parentClipItemId);
            }
          }}
        >
          {field.is_visible ? (
            <>
              <EyeOff className="mr-2 h-3.5 w-3.5" />
              Hide on overlay
            </>
          ) : (
            <>
              <Eye className="mr-2 h-3.5 w-3.5" />
              Show on overlay
            </>
          )}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
