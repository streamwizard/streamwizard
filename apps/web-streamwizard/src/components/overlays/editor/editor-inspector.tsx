"use client";

import { useEffect, useRef, useState } from "react";
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
import { Database } from "@repo/supabase";
import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Copy,
  LayoutTemplate,
  Maximize2,
  StretchHorizontal,
  StretchVertical,
  Trash2,
} from "lucide-react";
import type { OverlayItem } from "@/types/overlays";
import { asClipDisplayFieldConfig } from "@/types/overlays";
import {
  clampCrop,
  clampScale,
  getCropInsets,
  getDesignSize,
  getItemScale,
  hasCrop,
  NO_CROP,
  type CropInsets,
} from "@repo/ui/overlay";
import { getOverlayWidgetDefinition } from "../registry/overlay-widget-registry";
import { InspectorSection } from "./inspector-section";
import { selectPrimarySelectedId, useOverlayStore } from "./use-overlay-store";

interface EditorInspectorProps {
  clipFolders: Database["public"]["Tables"]["clip_folders"]["Row"][];
}

export function EditorInspector({ clipFolders }: EditorInspectorProps) {
  const {
    scene,
    selectedItemIds,
    updateItem,
    editorMode,
    pushHistory,
    renameRequestId,
    setRenameRequestId,
    duplicateSelectedItems,
    removeSelectedItems,
  } = useOverlayStore();

  const selectedItemId = selectPrimarySelectedId({ selectedItemIds });
  const selectedItem = scene?.items.find((i) => i.id === selectedItemId);
  const def = selectedItem
    ? getOverlayWidgetDefinition(selectedItem.type)
    : undefined;

  const sceneW = scene?.width ?? 1920;
  const sceneH = scene?.height ?? 1080;

  const [sceneLayoutOpen, setSceneLayoutOpen] = useState(false);
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSceneLayoutOpen(false);
  }, [selectedItemId]);

  // Canvas context-menu "Rename" focuses the Label input.
  useEffect(() => {
    if (renameRequestId && renameRequestId === selectedItemId) {
      labelInputRef.current?.focus();
      labelInputRef.current?.select();
      setRenameRequestId(null);
    }
  }, [renameRequestId, selectedItemId, setRenameRequestId]);

  if (selectedItemIds.length > 1) {
    return (
      <div className="p-4 space-y-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Selection
        </h3>
        <p className="text-sm text-foreground">
          {selectedItemIds.length} items selected
        </p>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => duplicateSelectedItems()}
          >
            <Copy className="mr-2 h-3.5 w-3.5" />
            Duplicate all
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => removeSelectedItems()}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete all
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          Drag on the canvas to move all selected items together. Select a
          single item to edit its properties.
        </p>
      </div>
    );
  }

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

  const designSize = getDesignSize(item);
  const itemScale = getItemScale(item);
  const cropInsets = getCropInsets(item);
  const isCropped = hasCrop(item);

  /** Resize the whole widget, contents included. */
  function setScale(next: number) {
    const scale = clampScale(next);
    handleUpdate({
      w: Math.round(designSize.w * scale),
      h: Math.round(designSize.h * scale),
    });
  }

  function setScalePercent(percent: number) {
    if (!Number.isFinite(percent) || percent <= 0) return;
    setScale(percent / 100);
  }

  function setRenderedWidth(w: number) {
    if (!Number.isFinite(w) || w <= 0) return;
    setScale(w / designSize.w);
  }

  function setRenderedHeight(h: number) {
    if (!Number.isFinite(h) || h <= 0) return;
    setScale(h / designSize.h);
  }

  /**
   * Crop hides part of the content and shrinks the box to match, leaving the
   * scale alone. Stretch the box back out afterwards and you have zoomed in
   * without the widget ever leaving the canvas.
   */
  function setCropInset(edge: keyof CropInsets, value: number) {
    if (!Number.isFinite(value) || value < 0) return;
    const next = clampCrop({ ...cropInsets, [edge]: value }, designSize);
    applyCrop(next);
  }

  function applyCrop(next: CropInsets) {
    handleUpdate({
      crop_top: next.top,
      crop_right: next.right,
      crop_bottom: next.bottom,
      crop_left: next.left,
      w: Math.round((designSize.w - next.left - next.right) * itemScale),
      h: Math.round((designSize.h - next.top - next.bottom) * itemScale),
    });
  }

  /** Resize the layout box without touching how big the content renders. */
  function setDesignWidth(designW: number) {
    if (!Number.isFinite(designW) || designW <= 0) return;
    handleUpdate({
      design_w: designW,
      w: Math.round(designW * itemScale),
    });
  }

  function setDesignHeight(designH: number) {
    if (!Number.isFinite(designH) || designH <= 0) return;
    handleUpdate({
      design_h: designH,
      h: Math.round(designH * itemScale),
    });
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

  /**
   * Fitting scales the widget rather than stretching its frame, so a widget
   * fitted to the scene keeps its proportions instead of distorting.
   */
  function scaleLayoutTarget(scale: number, position: Partial<OverlayItem>) {
    if (layoutLocked) return;
    const design = getDesignSize(layoutTarget);
    const s = clampScale(scale);
    updateItem(layoutTarget.id, {
      ...position,
      w: Math.round(design.w * s),
      h: Math.round(design.h * s),
    });
  }

  function fitToScene() {
    const design = getDesignSize(layoutTarget);
    scaleLayoutTarget(Math.min(sceneW / design.w, sceneH / design.h), {
      x: 0,
      y: 0,
    });
  }

  function fitSceneWidth() {
    scaleLayoutTarget(sceneW / getDesignSize(layoutTarget).w, { x: 0 });
  }

  function fitSceneHeight() {
    scaleLayoutTarget(sceneH / getDesignSize(layoutTarget).h, { y: 0 });
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
              ref={labelInputRef}
              value={item.label}
              onFocus={() => pushHistory()}
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
                onFocus={() => pushHistory()}
                onChange={(e) => handleUpdate({ x: Number(e.target.value) })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Y</Label>
              <Input
                type="number"
                value={Math.round(item.y)}
                onFocus={() => pushHistory()}
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
                onFocus={() => pushHistory()}
                onChange={(e) => setRenderedWidth(Number(e.target.value))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Height</Label>
              <Input
                type="number"
                value={Math.round(item.h)}
                onFocus={() => pushHistory()}
                onChange={(e) => setRenderedHeight(Number(e.target.value))}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Size</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={Math.round(itemScale * 100)}
                  onFocus={() => pushHistory()}
                  onChange={(e) => setScalePercent(Number(e.target.value))}
                  className="h-8 text-sm pr-6"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  %
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">&nbsp;</Label>
              <Button
                type="button"
                variant="outline"
                className="h-8 w-full text-xs"
                disabled={item.is_locked || itemScale === 1}
                onClick={() => {
                  pushHistory();
                  setScalePercent(100);
                }}
              >
                Reset to 100%
              </Button>
            </div>
          </div>

          {/*
            The frame is the box the widget lays itself out in. Widening it gives
            text more room to wrap; it never changes how big the text is.
          */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Frame width</Label>
              <Input
                type="number"
                value={Math.round(designSize.w)}
                onFocus={() => pushHistory()}
                onChange={(e) => setDesignWidth(Number(e.target.value))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Frame height</Label>
              <Input
                type="number"
                value={Math.round(designSize.h)}
                onFocus={() => pushHistory()}
                onChange={(e) => setDesignHeight(Number(e.target.value))}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Crop</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={item.is_locked || !isCropped}
                onClick={() => {
                  pushHistory();
                  applyCrop(NO_CROP);
                }}
              >
                Reset
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ["top", "Top"],
                  ["right", "Right"],
                  ["bottom", "Bottom"],
                  ["left", "Left"],
                ] as const
              ).map(([edge, label]) => (
                <div key={edge} className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground">
                    {label}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={Math.round(cropInsets[edge])}
                    onFocus={() => pushHistory()}
                    onChange={(e) => setCropInset(edge, Number(e.target.value))}
                    className="h-8 text-sm px-2"
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Crop away what you don&apos;t need, then drag a corner to stretch
              the rest back out — that zooms in without leaving the canvas. Hold
              Alt and drag a handle to crop on the canvas.
            </p>
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

          {/* Simple mode hides rotation/z-index/opacity entirely */}
          {editorMode === "pro" && (
          <InspectorSection title="Advanced">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Rotation</Label>
                  <Input
                    type="number"
                    value={item.rotation}
                    onFocus={() => pushHistory()}
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
                    onFocus={() => pushHistory()}
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
                  onPointerDown={() => pushHistory()}
                  onValueChange={([val]) => handleUpdate({ opacity: val / 100 })}
                  min={0}
                  max={100}
                  step={1}
                  className="py-1"
                />
              </div>
            </div>
          </InspectorSection>
          )}
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
