"use client";

import { Button } from "@repo/ui";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
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
import { useOverlayStore } from "./use-overlay-store";

export function EditorLayers() {
  const {
    scene,
    selectedItemId,
    selectItem,
    updateItem,
    removeItem,
    duplicateItem,
    reorderItem,
    toggleItemVisibility,
    toggleItemLock,
  } = useOverlayStore();

  if (!scene) return null;

  const selected = scene.items.find((i) => i.id === selectedItemId);

  const rootItems = [...scene.items]
    .filter((i) => isRootLayerType(i.type))
    .sort((a, b) => b.z_index - a.z_index);

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

      {rootItems.map((item) => {
        const hasFieldSelectedUnderThis =
          selected?.type === "clip_display_field" &&
          asClipDisplayFieldConfig(selected.config).parentClipItemId === item.id;
        const isParentRowSelected =
          selectedItemId === item.id && !hasFieldSelectedUnderThis;

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
          <div key={item.id} className="space-y-0.5">
            <div
              className={`
              flex items-center gap-1.5 rounded-md px-2 py-1.5 cursor-pointer text-sm
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
              onClick={() => selectItem(item.id)}
            >
              <span className="flex-1 truncate text-xs">{item.label}</span>

              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
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
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(item.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {clipComposite &&
              clipChildren.map((child, panelIndex) => {
                const fc = asClipDisplayFieldConfig(child.config);
                const field = fc.fieldKey;
                const locked = fc.isLayoutLocked;
                const enabled = child.is_visible;
                const fieldSelected = selectedItemId === child.id;
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
                          if (enabled && selectedItemId === child.id) {
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
                          if (selectedItemId === child.id) {
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
        );
      })}
    </div>
  );
}
