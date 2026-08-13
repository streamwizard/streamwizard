"use client";

import { useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
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
import { Button, Input } from "@repo/ui";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Lock,
  Trash2,
  Unlock,
} from "lucide-react";
import type { ClipsWidgetConfig, RootOverlayItemType } from "@/types/overlays";
import {
  asClipDisplayFieldConfig,
  buildCompositeClipsConfig,
} from "@/types/overlays";
import {
  getRootOverlayWidgetDefinition,
  isRootLayerType,
} from "../registry/overlay-widget-registry";
import { DISPLAY_FIELD_LABELS } from "../widgets/clips/nested-fields";
import { LayerContextMenu } from "./layer-context-menu";
import { SortableLayerRow } from "./sortable-layer-row";
import { selectPrimarySelectedId, useOverlayStore } from "@/stores/overlay-editor-store";

export function EditorLayers() {
  const {
    scene,
    selectedItemIds,
    selectItem,
    toggleSelectItem,
    updateItem,
    removeItem,
    duplicateItem,
    reorderItem,
    renameItem,
    setLayerOrder,
    toggleItemVisibility,
    toggleItemLock,
  } = useOverlayStore();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const sensors = useSensors(
    // 5px activation distance keeps plain click-to-select working on rows.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!scene) return null;

  const primarySelectedId = selectPrimarySelectedId({ selectedItemIds });
  const selected = scene.items.find((i) => i.id === primarySelectedId);

  const rootItems = [...scene.items]
    .filter((i) => isRootLayerType(i.type))
    .sort((a, b) => b.z_index - a.z_index);
  const rootIds = rootItems.map((i) => i.id);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rootIds.indexOf(String(active.id));
    const newIndex = rootIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    setLayerOrder(arrayMove(rootIds, oldIndex, newIndex));
  }

  function commitRename(id: string) {
    const trimmed = renameDraft.trim();
    const current = scene?.items.find((i) => i.id === id);
    if (trimmed && current && trimmed !== current.label) {
      renameItem(id, trimmed);
    }
    setRenamingId(null);
  }

  return (
    <div className="p-3 space-y-1">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Layers
      </h3>

      {rootItems.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">
          No items yet. Open Widgets in the header to add clips, text, a
          countdown, or a clock.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
          {rootItems.map((item) => {
            const hasFieldSelectedUnderThis =
              selected?.type === "clip_display_field" &&
              asClipDisplayFieldConfig(selected.config).parentClipItemId === item.id;
            const isParentRowSelected =
              selectedItemIds.includes(item.id) && !hasFieldSelectedUnderThis;

            const parentDef = getRootOverlayWidgetDefinition(
              item.type as RootOverlayItemType
            );
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
              <SortableLayerRow key={item.id} id={item.id}>
                {({ attributes, listeners }) => (
                  <div className="space-y-0.5">
                    <LayerContextMenu
                      item={item}
                      onRename={() => {
                        setRenamingId(item.id);
                        setRenameDraft(item.label);
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
                          if (e.shiftKey) {
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

                        {renamingId === item.id ? (
                          <Input
                            autoFocus
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={() => commitRename(item.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(item.id);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            className="h-5 flex-1 text-xs px-1"
                          />
                        ) : (
                          <span
                            className="flex-1 truncate text-xs"
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setRenamingId(item.id);
                              setRenameDraft(item.label);
                            }}
                          >
                            {item.label}
                          </span>
                        )}

                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            title="Bring forward"
                            onClick={(e) => {
                              e.stopPropagation();
                              reorderItem(item.id, "up");
                            }}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            title="Send backward"
                            onClick={(e) => {
                              e.stopPropagation();
                              reorderItem(item.id, "down");
                            }}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            title="Duplicate"
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateItem(item.id);
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            title={item.is_visible ? "Hide" : "Show"}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleItemVisibility(item.id);
                            }}
                          >
                            {item.is_visible ? (
                              <Eye className="h-3 w-3" />
                            ) : (
                              <EyeOff className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            title={item.is_locked ? "Unlock" : "Lock"}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleItemLock(item.id);
                            }}
                          >
                            {item.is_locked ? (
                              <Lock className="h-3 w-3" />
                            ) : (
                              <Unlock className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-destructive hover:text-destructive"
                            title="Delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeItem(item.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </LayerContextMenu>

                    {clipComposite &&
                      clipChildren.map((child, panelIndex) => {
                        const fc = asClipDisplayFieldConfig(child.config);
                        const field = fc.fieldKey;
                        const locked = fc.isLayoutLocked;
                        const enabled = child.is_visible;
                        const fieldSelected = selectedItemIds.includes(child.id);
                        const canMoveUp = panelIndex > 0;
                        const canMoveDown = panelIndex < clipChildren.length - 1;

                        const swapStack = (other: typeof child) => {
                          const o = asClipDisplayFieldConfig(other.config);
                          updateItem(child.id, {
                            config: { ...fc, stackOrder: o.stackOrder },
                          });
                          updateItem(other.id, {
                            config: { ...o, stackOrder: fc.stackOrder },
                          });
                        };

                        return (
                          <div
                            key={child.id}
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
                              {locked ? (
                                <Lock className="inline h-2.5 w-2.5 ml-1 opacity-70 align-text-bottom" />
                              ) : null}
                            </button>

                            <div className="flex items-center gap-0 shrink-0 opacity-0 group-hover/field:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                title="Bring forward"
                                disabled={!canMoveUp}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  swapStack(clipChildren[panelIndex - 1]!);
                                }}
                              >
                                <ArrowUp className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                title="Send backward"
                                disabled={!canMoveDown}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  swapStack(clipChildren[panelIndex + 1]!);
                                }}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                title={
                                  enabled ? "Hide on overlay" : "Show on overlay"
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
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
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                title={
                                  locked
                                    ? "Unlock in editor"
                                    : "Lock position & size"
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateItem(child.id, {
                                    config: {
                                      ...fc,
                                      isLayoutLocked: !locked,
                                    },
                                  });
                                }}
                              >
                                {locked ? (
                                  <Lock className="h-3 w-3" />
                                ) : (
                                  <Unlock className="h-3 w-3" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-destructive hover:text-destructive"
                                title="Hide field"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (child.is_visible) {
                                    toggleItemVisibility(child.id);
                                  }
                                  if (selectedItemIds.includes(child.id)) {
                                    selectItem(item.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </SortableLayerRow>
            );
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
}
