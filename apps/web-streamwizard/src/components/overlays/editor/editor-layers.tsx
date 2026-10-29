"use client";

import { useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button, cn, Input } from "@repo/ui";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FolderClosed,
  FolderOpen,
  GripVertical,
  Lock,
  Unlock,
} from "lucide-react";
import type {
  ClipsWidgetConfig,
  OverlayItem,
  OverlayItemGroup,
  RootOverlayItemType,
} from "@/types/overlays";
import {
  asClipDisplayFieldConfig,
  buildCompositeClipsConfig,
} from "@/types/overlays";
import {
  getRootOverlayWidgetDefinition,
  isRootLayerType,
} from "../registry/overlay-widget-registry";
import { DISPLAY_FIELD_LABELS } from "../widgets/clips/nested-fields";
import {
  ClipFieldContextMenu,
  GroupContextMenu,
  LayerContextMenu,
} from "./layer-context-menu";
import {
  groupItemIds,
  indexGroups,
  nodeParentId,
  orderedChildren,
  type LayerNode,
} from "./item-groups";
import { extendsSelection } from "./selection-modifiers";
import { SortableLayerRow } from "./sortable-layer-row";
import { selectPrimarySelectedId, useOverlayStore } from "@/stores/overlay-editor-store";

/** Sortable ids: items keep their own id, groups are prefixed so the two can't collide. */
const GROUP_KEY_PREFIX = "group:";

function nodeKey(node: LayerNode): string {
  return node.kind === "group" ? `${GROUP_KEY_PREFIX}${node.id}` : node.id;
}

function nodeFromKey(key: UniqueIdentifier): LayerNode {
  const k = String(key);
  return k.startsWith(GROUP_KEY_PREFIX)
    ? { kind: "group", id: k.slice(GROUP_KEY_PREFIX.length) }
    : { kind: "item", id: k };
}

/** Inline rename state, shared by item and group rows so only one edits at a time. */
interface RenameState {
  renamingId: string | null;
  draft: string;
  setDraft: (value: string) => void;
  start: (id: string, label: string) => void;
  commit: (id: string) => void;
  cancel: () => void;
}

export function EditorLayers() {
  const { scene, renameItem, renameGroup, setChildOrder } = useOverlayStore();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const sensors = useSensors(
    // 5px activation distance keeps plain click-to-select working on rows.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!scene) return null;

  const groups = scene.groups ?? [];
  const index = indexGroups(groups);
  const hasRootItems = scene.items.some((i) => isRootLayerType(i.type));
  const containerOf = (key: UniqueIdentifier) =>
    nodeParentId(nodeFromKey(key), scene.items, index);

  // Rows only trade places with their siblings, so only siblings are drop targets.
  const collisionDetection: CollisionDetection = (args) => {
    const container = containerOf(args.active.id);
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (c) => containerOf(c.id) === container
      ),
    });
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !scene) return;
    const containerId = containerOf(active.id);
    if (containerOf(over.id) !== containerId) return;
    const children = orderedChildren(containerId, scene.items, groups);
    const keys = children.map(nodeKey);
    const oldIndex = keys.indexOf(String(active.id));
    const newIndex = keys.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    setChildOrder(containerId, arrayMove(children, oldIndex, newIndex));
  }

  const rename: RenameState = {
    renamingId,
    draft: renameDraft,
    setDraft: setRenameDraft,
    start: (id, label) => {
      setRenamingId(id);
      setRenameDraft(label);
    },
    commit: (id) => {
      const trimmed = renameDraft.trim();
      const item = scene.items.find((i) => i.id === id);
      if (item) {
        if (trimmed && trimmed !== item.label) renameItem(id, trimmed);
      } else if (trimmed) {
        renameGroup(id, trimmed);
      }
      setRenamingId(null);
    },
    cancel: () => setRenamingId(null),
  };

  const toggleCollapsed = (groupId: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });

  return (
    <div className="p-3 space-y-1">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Layers
      </h3>

      {!hasRootItems && (
        <p className="text-xs text-muted-foreground text-center py-6">
          No items yet. Open Widgets in the header to add clips, text, a
          countdown, or a clock.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <LayerList
          containerId={null}
          rename={rename}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </DndContext>
    </div>
  );
}

interface LayerListProps {
  containerId: string | null;
  rename: RenameState;
  collapsed: ReadonlySet<string>;
  onToggleCollapsed: (groupId: string) => void;
}

/** A container's children, top first: group rows and item rows mixed. */
function LayerList({ containerId, rename, collapsed, onToggleCollapsed }: LayerListProps) {
  const scene = useOverlayStore((s) => s.scene);
  if (!scene) return null;
  const groups = scene.groups ?? [];
  const children = orderedChildren(containerId, scene.items, groups);
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const itemById = new Map(scene.items.map((i) => [i.id, i]));

  return (
    <SortableContext items={children.map(nodeKey)} strategy={verticalListSortingStrategy}>
      {children.map((child) => {
        if (child.kind === "group") {
          const group = groupById.get(child.id);
          if (!group) return null;
          return (
            <GroupLayerRow
              key={nodeKey(child)}
              group={group}
              rename={rename}
              collapsed={collapsed}
              onToggleCollapsed={onToggleCollapsed}
            />
          );
        }
        const item = itemById.get(child.id);
        return item ? <ItemLayerRow key={item.id} item={item} rename={rename} /> : null;
      })}
    </SortableContext>
  );
}

/**
 * A group's row: one block that drags, hides and locks as a whole, with its
 * children indented below it unless collapsed.
 */
function GroupLayerRow({
  group,
  rename,
  collapsed,
  onToggleCollapsed,
}: {
  group: OverlayItemGroup;
  rename: RenameState;
  collapsed: ReadonlySet<string>;
  onToggleCollapsed: (groupId: string) => void;
}) {
  const { scene, selectedItemIds, selectNode, toggleGroupVisibility, toggleGroupLock } =
    useOverlayStore();
  if (!scene) return null;

  const node: LayerNode = { kind: "group", id: group.id };
  const memberIds = groupItemIds(group.id, scene.items, indexGroups(scene.groups ?? []));
  const members = scene.items.filter((i) => memberIds.includes(i.id));
  const isSelected = memberIds.length > 0 && memberIds.every((id) => selectedItemIds.includes(id));
  const allHidden = members.length > 0 && members.every((i) => !i.is_visible);
  const allLocked = members.length > 0 && members.every((i) => i.is_locked);
  const isCollapsed = collapsed.has(group.id);
  const FolderIcon = isCollapsed ? FolderClosed : FolderOpen;
  const Chevron = isCollapsed ? ChevronRight : ChevronDown;

  return (
    <SortableLayerRow id={nodeKey(node)}>
      {({ attributes, listeners }) => (
        <div className="space-y-0.5">
          <GroupContextMenu group={group} onRename={() => rename.start(group.id, group.label)}>
            <div
              className={cn(
                "flex items-center gap-1 rounded-md pl-0.5 pr-2 py-1.5 cursor-pointer text-sm transition-colors group",
                isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                allHidden && "opacity-50"
              )}
              onClick={(e) => selectNode(node, extendsSelection(e))}
              onContextMenu={() => {
                if (!isSelected) selectNode(node);
              }}
            >
              <button
                type="button"
                className="h-5 w-4 shrink-0 flex items-center justify-center rounded text-muted-foreground/60 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-grab active:cursor-grabbing"
                aria-label={`Reorder ${group.label}`}
                onClick={(e) => e.stopPropagation()}
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-3 w-3" />
              </button>

              <button
                type="button"
                className="h-4 w-4 shrink-0 flex items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={isCollapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}
                aria-expanded={!isCollapsed}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapsed(group.id);
                }}
              >
                <Chevron className="h-3 w-3" />
              </button>

              <FolderIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />

              {rename.renamingId === group.id ? (
                <Input
                  autoFocus
                  value={rename.draft}
                  maxLength={100}
                  onChange={(e) => rename.setDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => rename.commit(group.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") rename.commit(group.id);
                    if (e.key === "Escape") rename.cancel();
                  }}
                  className="h-5 flex-1 text-xs px-1"
                />
              ) : (
                <span
                  className="flex-1 min-w-0 truncate text-xs font-medium"
                  title={group.label}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    rename.start(group.id, group.label);
                  }}
                >
                  {group.label}
                </span>
              )}

              <div className="flex items-center gap-0.5 shrink-0">
                <RowToggle
                  title={allHidden ? "Show all" : "Hide all"}
                  active={allHidden}
                  groupHover="group-hover:opacity-100"
                  onClick={() => toggleGroupVisibility(group.id)}
                >
                  {allHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </RowToggle>
                <RowToggle
                  title={allLocked ? "Unlock all" : "Lock all"}
                  active={allLocked}
                  groupHover="group-hover:opacity-100"
                  onClick={() => toggleGroupLock(group.id)}
                >
                  {allLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                </RowToggle>
              </div>
            </div>
          </GroupContextMenu>

          {!isCollapsed && (
            <div className="ml-2 pl-1 border-l border-border/70 space-y-0.5">
              <LayerList
                containerId={group.id}
                rename={rename}
                collapsed={collapsed}
                onToggleCollapsed={onToggleCollapsed}
              />
            </div>
          )}
        </div>
      )}
    </SortableLayerRow>
  );
}

/** One root item's row, plus its clip display fields when it is a clips widget. */
function ItemLayerRow({ item, rename }: { item: OverlayItem; rename: RenameState }) {
  const {
    scene,
    selectedItemIds,
    selectItem,
    toggleSelectItem,
    updateItem,
    toggleItemVisibility,
    toggleItemLock,
  } = useOverlayStore();
  if (!scene) return null;

  const primarySelectedId = selectPrimarySelectedId({ selectedItemIds });
  const selected = scene.items.find((i) => i.id === primarySelectedId);

  const hasFieldSelectedUnderThis =
    selected?.type === "clip_display_field" &&
    asClipDisplayFieldConfig(selected.config).parentClipItemId === item.id;
  const isParentRowSelected =
    selectedItemIds.includes(item.id) && !hasFieldSelectedUnderThis;

  const parentDef = getRootOverlayWidgetDefinition(
    item.type as RootOverlayItemType
  );
  const TypeIcon = parentDef.icon;
  const clipChildren = parentDef.getChildItems
    ? parentDef.getChildItems(scene.items, item.id).sort(
        (a, b) =>
          asClipDisplayFieldConfig(b.config).stackOrder -
          asClipDisplayFieldConfig(a.config).stackOrder
      )
    : [];

  const clipComposite: ClipsWidgetConfig | null =
    item.type === "clips_widget"
      ? buildCompositeClipsConfig(item, scene.items)
      : null;

  return (
    <SortableLayerRow id={item.id}>
      {({ attributes, listeners }) => (
        <div className="space-y-0.5">
          <LayerContextMenu
            item={item}
            onRename={() => {
              rename.start(item.id, item.label);
            }}
          >
            <div
              className={`
              flex items-center gap-1 rounded-md pl-0.5 pr-2 py-1.5 cursor-pointer text-sm
              transition-colors group
              ${
                isParentRowSelected
                  ? "bg-accent text-accent-foreground"
                  : hasFieldSelectedUnderThis
                    ? "bg-accent/40 hover:bg-accent/50"
                    : "hover:bg-accent/50"
              }
              ${!item.is_visible ? "opacity-50" : ""}
            `}
              onClick={(e) => {
                if (extendsSelection(e)) {
                  toggleSelectItem(item.id);
                } else {
                  selectItem(item.id);
                }
              }}
            >
              <button
                type="button"
                className="h-5 w-4 shrink-0 flex items-center justify-center rounded text-muted-foreground/60 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-grab active:cursor-grabbing"
                aria-label={`Reorder ${item.label}`}
                onClick={(e) => e.stopPropagation()}
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-3 w-3" />
              </button>

              <TypeIcon
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />

              {rename.renamingId === item.id ? (
                <Input
                  autoFocus
                  value={rename.draft}
                  onChange={(e) => rename.setDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => rename.commit(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") rename.commit(item.id);
                    if (e.key === "Escape") rename.cancel();
                  }}
                  className="h-5 flex-1 text-xs px-1"
                />
              ) : (
                <span
                  className="flex-1 min-w-0 truncate text-xs"
                  title={item.label}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    rename.start(item.id, item.label);
                  }}
                >
                  {item.label}
                </span>
              )}

              {/*
                Only show/lock live on the row. Order, duplicate and
                delete sit in the right-click menu, so the name keeps
                the width.
              */}
              <div className="flex items-center gap-0.5 shrink-0">
                <RowToggle
                  title={item.is_visible ? "Hide" : "Show"}
                  active={!item.is_visible}
                  groupHover="group-hover:opacity-100"
                  onClick={() => toggleItemVisibility(item.id)}
                >
                  {item.is_visible ? (
                    <Eye className="h-3 w-3" />
                  ) : (
                    <EyeOff className="h-3 w-3" />
                  )}
                </RowToggle>
                <RowToggle
                  title={item.is_locked ? "Unlock" : "Lock"}
                  active={item.is_locked}
                  groupHover="group-hover:opacity-100"
                  onClick={() => toggleItemLock(item.id)}
                >
                  {item.is_locked ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <Unlock className="h-3 w-3" />
                  )}
                </RowToggle>
              </div>
            </div>
          </LayerContextMenu>

          {clipComposite &&
            clipChildren.map((child) => {
              const fc = asClipDisplayFieldConfig(child.config);
              const field = fc.fieldKey;
              const locked = fc.isLayoutLocked;
              const enabled = child.is_visible;
              const fieldSelected = selectedItemIds.includes(child.id);

              return (
                <ClipFieldContextMenu
                  key={child.id}
                  field={child}
                  siblings={clipChildren}
                >
                  <div
                    className={`
                      ml-2 pl-2 border-l border-border/70 flex items-center gap-1 rounded px-1 py-1 text-[11px] leading-tight
                      transition-colors group/field
                      ${fieldSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/40 text-muted-foreground hover:text-foreground"}
                      ${!enabled ? "opacity-50" : ""}
                    `}
                  >
                    <button
                      type="button"
                      className="flex-1 min-w-0 text-left truncate cursor-pointer rounded px-1 py-0.5"
                      onClick={() => selectItem(child.id)}
                    >
                      {DISPLAY_FIELD_LABELS[field]}
                    </button>

                    <div className="flex items-center gap-0 shrink-0">
                      <RowToggle
                        title={enabled ? "Hide on overlay" : "Show on overlay"}
                        active={!enabled}
                        groupHover="group-hover/field:opacity-100"
                        onClick={() => {
                          toggleItemVisibility(child.id);
                          if (enabled && selectedItemIds.includes(child.id)) {
                            selectItem(item.id);
                          }
                        }}
                      >
                        {enabled ? (
                          <Eye className="h-3 w-3" />
                        ) : (
                          <EyeOff className="h-3 w-3" />
                        )}
                      </RowToggle>
                      <RowToggle
                        title={locked ? "Unlock in editor" : "Lock position & size"}
                        active={locked}
                        groupHover="group-hover/field:opacity-100"
                        onClick={() =>
                          updateItem(child.id, {
                            config: { ...fc, isLayoutLocked: !locked },
                          })
                        }
                      >
                        {locked ? (
                          <Lock className="h-3 w-3" />
                        ) : (
                          <Unlock className="h-3 w-3" />
                        )}
                      </RowToggle>
                    </div>
                  </div>
                </ClipFieldContextMenu>
              );
            })}
        </div>
      )}
    </SortableLayerRow>
  );
}

/**
 * Show/lock button on a layer row. Hidden until the row is hovered, unless it
 * is already switched on: a hidden or locked layer should say so without a
 * mouse over it.
 */
function RowToggle({
  title,
  active,
  groupHover,
  onClick,
  children,
}: {
  title: string;
  active: boolean;
  /** The parent row's hover variant, e.g. `group-hover:opacity-100`. */
  groupHover: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "h-5 w-5 transition-opacity focus-visible:opacity-100",
        groupHover,
        active ? "opacity-100" : "opacity-0"
      )}
      title={title}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </Button>
  );
}
