"use client";

import { useEffect, useState } from "react";
import { Button } from "@repo/ui";
import { Input } from "@repo/ui";
import { Label } from "@repo/ui";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui";
import { Separator } from "@repo/ui";
import { Slider } from "@repo/ui";
import { Database } from "@/types/supabase";
import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  LayoutTemplate,
  Maximize2,
  StretchHorizontal,
  StretchVertical,
} from "lucide-react";
import type { OverlayItem } from "@/types/overlays";
import { asClipDisplayFieldConfig } from "@/types/overlays";
import { getOverlayWidgetDefinition } from "../registry/overlay-widget-registry";
import { useOverlayStore } from "./use-overlay-store";

interface EditorInspectorProps {
  clipFolders: Database["public"]["Tables"]["clip_folders"]["Row"][];
}

export function EditorInspector({ clipFolders }: EditorInspectorProps) {
  const { scene, selectedItemId, updateItem } = useOverlayStore();

  const selectedItem = scene?.items.find((i) => i.id === selectedItemId);
  const def = selectedItem
    ? getOverlayWidgetDefinition(selectedItem.type)
    : undefined;

  const sceneW = scene?.width ?? 1920;
  const sceneH = scene?.height ?? 1080;

  const [sceneLayoutOpen, setSceneLayoutOpen] = useState(false);

  useEffect(() => {
    setSceneLayoutOpen(false);
  }, [selectedItemId]);

  if (!selectedItem) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        <p className="mt-12">Select an item on the canvas to edit its properties.</p>
      </div>
    );
  }

  const item = selectedItem;

  function handleUpdate(updates: Partial<OverlayItem>) {
    updateItem(item.id, updates);
  }

  /** Geometry targets the clips widget when a nested display field is selected. */
  const layoutTarget: OverlayItem =
    item.type === "clip_display_field"
      ? scene?.items.find(
          (i) =>
            i.id ===
            asClipDisplayFieldConfig(item.config).parentClipItemId
        ) ?? item
      : item;

  const layoutLocked = layoutTarget.is_locked;

  function fitToScene() {
    if (layoutLocked) return;
    updateItem(layoutTarget.id, {
      x: 0,
      y: 0,
      w: sceneW,
      h: sceneH,
    });
  }

  function fitSceneWidth() {
    if (layoutLocked) return;
    updateItem(layoutTarget.id, {
      x: 0,
      w: sceneW,
    });
  }

  function fitSceneHeight() {
    if (layoutLocked) return;
    updateItem(layoutTarget.id, {
      y: 0,
      h: sceneH,
    });
  }

  function alignLeft() {
    if (layoutLocked) return;
    updateItem(layoutTarget.id, { x: 0 });
  }

  function alignHorizontalCenter() {
    if (layoutLocked) return;
    updateItem(layoutTarget.id, {
      x: Math.max(0, Math.round((sceneW - layoutTarget.w) / 2)),
    });
  }

  function alignRight() {
    if (layoutLocked) return;
    updateItem(layoutTarget.id, {
      x: Math.max(0, Math.round(sceneW - layoutTarget.w)),
    });
  }

  function alignTop() {
    if (layoutLocked) return;
    updateItem(layoutTarget.id, { y: 0 });
  }

  function alignVerticalCenter() {
    if (layoutLocked) return;
    updateItem(layoutTarget.id, {
      y: Math.max(0, Math.round((sceneH - layoutTarget.h) / 2)),
    });
  }

  function alignBottom() {
    if (layoutLocked) return;
    updateItem(layoutTarget.id, {
      y: Math.max(0, Math.round(sceneH - layoutTarget.h)),
    });
  }

  const Settings = def?.SettingsPanel;

  return (
    <div className="p-4 space-y-5">
      <div>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Properties
        </h3>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Label</Label>
            <Input
              value={item.label}
              onChange={(e) => handleUpdate({ label: e.target.value })}
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">X</Label>
              <Input
                type="number"
                value={Math.round(item.x)}
                onChange={(e) => handleUpdate({ x: Number(e.target.value) })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Y</Label>
              <Input
                type="number"
                value={Math.round(item.y)}
                onChange={(e) => handleUpdate({ y: Number(e.target.value) })}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Width</Label>
              <Input
                type="number"
                value={Math.round(item.w)}
                onChange={(e) =>
                  handleUpdate({ w: Math.max(50, Number(e.target.value)) })
                }
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Height</Label>
              <Input
                type="number"
                value={Math.round(item.h)}
                onChange={(e) =>
                  handleUpdate({ h: Math.max(50, Number(e.target.value)) })
                }
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Scene layout</Label>
              <Popover open={sceneLayoutOpen} onOpenChange={setSceneLayoutOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={layoutLocked}
                    aria-label="Open scene layout tools"
                  >
                    <LayoutTemplate className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-3">
                  <p className="text-xs font-medium text-foreground mb-2">
                    Snap to scene ({sceneW}×{sceneH})
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-full"
                      disabled={layoutLocked}
                      aria-label="Fit to screen"
                      onClick={() => {
                        fitToScene();
                        setSceneLayoutOpen(false);
                      }}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-full"
                        disabled={layoutLocked}
                        aria-label="Full width"
                        onClick={() => {
                          fitSceneWidth();
                          setSceneLayoutOpen(false);
                        }}
                      >
                        <StretchHorizontal className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-full"
                        disabled={layoutLocked}
                        aria-label="Full height"
                        onClick={() => {
                          fitSceneHeight();
                          setSceneLayoutOpen(false);
                        }}
                      >
                        <StretchVertical className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9"
                        disabled={layoutLocked}
                        aria-label="Align left"
                        onClick={() => {
                          alignLeft();
                          setSceneLayoutOpen(false);
                        }}
                      >
                        <AlignHorizontalJustifyStart className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9"
                        disabled={layoutLocked}
                        aria-label="Align horizontal center"
                        onClick={() => {
                          alignHorizontalCenter();
                          setSceneLayoutOpen(false);
                        }}
                      >
                        <AlignHorizontalJustifyCenter className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9"
                        disabled={layoutLocked}
                        aria-label="Align right"
                        onClick={() => {
                          alignRight();
                          setSceneLayoutOpen(false);
                        }}
                      >
                        <AlignHorizontalJustifyEnd className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9"
                        disabled={layoutLocked}
                        aria-label="Align top"
                        onClick={() => {
                          alignTop();
                          setSceneLayoutOpen(false);
                        }}
                      >
                        <AlignVerticalJustifyStart className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9"
                        disabled={layoutLocked}
                        aria-label="Align vertical center"
                        onClick={() => {
                          alignVerticalCenter();
                          setSceneLayoutOpen(false);
                        }}
                      >
                        <AlignVerticalJustifyCenter className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9"
                        disabled={layoutLocked}
                        aria-label="Align bottom"
                        onClick={() => {
                          alignBottom();
                          setSceneLayoutOpen(false);
                        }}
                      >
                        <AlignVerticalJustifyEnd className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-3 leading-snug max-w-56">
                    Unlock the layer to use these tools.
                    {layoutTarget.id !== item.id ? (
                      <>
                        {" "}
                        Affects the{" "}
                        <span className="font-medium text-foreground">
                          clips widget
                        </span>{" "}
                        frame.
                      </>
                    ) : null}
                  </p>
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Position and size relative to the scene. Open the layout tool
              for align and fit options.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Rotation</Label>
              <Input
                type="number"
                value={item.rotation}
                onChange={(e) =>
                  handleUpdate({ rotation: Number(e.target.value) })
                }
                className="h-8 text-sm"
                min={-360}
                max={360}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Z-Index</Label>
              <Input
                type="number"
                value={item.z_index}
                onChange={(e) =>
                  handleUpdate({ z_index: Number(e.target.value) })
                }
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              Opacity ({Math.round(item.opacity * 100)}%)
            </Label>
            <Slider
              value={[item.opacity * 100]}
              onValueChange={([val]) => handleUpdate({ opacity: val / 100 })}
              min={0}
              max={100}
              step={1}
              className="py-1"
            />
          </div>
        </div>
      </div>

      {Settings ? (
        <>
          <Separator />
          <Settings
            item={item}
            updateItem={updateItem}
            clipFolders={clipFolders}
          />
        </>
      ) : null}
    </div>
  );
}
