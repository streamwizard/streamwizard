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
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Copy,
  LayoutTemplate,
  Maximize2,
  StretchHorizontal,
  StretchVertical,
  Trash2,
} from "lucide-react";
import type { OverlayItem } from "@/types/overlays";
import { NO_CROP, type CropInsets } from "@repo/ui/overlay";
import { getOverlayWidgetDefinition } from "../registry/overlay-widget-registry";
import { InspectorSection } from "./inspector-section";
import { NumberField } from "./number-field";
import { MIN_DISTRIBUTE_ITEMS } from "./selection-layout";
import { selectPrimarySelectedId, useOverlayStore } from "@/stores/overlay-editor-store";
import { useInspectorCommands } from "@/hooks/overlays/use-inspector-commands";

interface EditorInspectorProps {
  clipFolders: Database["public"]["Tables"]["clip_folders"]["Row"][];
}

export function EditorInspector({ clipFolders }: EditorInspectorProps) {
  const {
    scene,
    selectedItemIds,
    renameRequestId,
    setRenameRequestId,
    duplicateSelectedItems,
    removeSelectedItems,
    alignSelected,
    distributeSelected,
    matchSizeSelected,
  } = useOverlayStore();

  const selectedItemId = selectPrimarySelectedId({ selectedItemIds });
  const selectedItem = scene?.items.find((i) => i.id === selectedItemId);

  const labelInputRef = useRef<HTMLInputElement>(null);

  // Canvas context-menu "Rename" focuses the Label input.
  useEffect(() => {
    if (renameRequestId && renameRequestId === selectedItemId) {
      labelInputRef.current?.focus();
      labelInputRef.current?.select();
      setRenameRequestId(null);
    }
  }, [renameRequestId, selectedItemId, setRenameRequestId]);

  if (selectedItemIds.length > 1) {
    const canDistribute = selectedItemIds.length >= MIN_DISTRIBUTE_ITEMS;

    return (
      <div className="p-4 space-y-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Selection
        </h3>
        <p className="text-sm text-foreground">
          {selectedItemIds.length} items selected
        </p>

        <div className="space-y-2">
          <Label className="text-xs">Align to each other</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ["left", "Align left", AlignHorizontalJustifyStart],
                ["hcenter", "Align horizontal center", AlignHorizontalJustifyCenter],
                ["right", "Align right", AlignHorizontalJustifyEnd],
                ["top", "Align top", AlignVerticalJustifyStart],
                ["vcenter", "Align vertical center", AlignVerticalJustifyCenter],
                ["bottom", "Align bottom", AlignVerticalJustifyEnd],
              ] as const
            ).map(([edge, label, Icon]) => (
              <Button
                key={edge}
                type="button"
                variant="outline"
                size="icon"
                className="h-9"
                aria-label={label}
                title={label}
                onClick={() => alignSelected(edge)}
              >
                <Icon className="h-4 w-4" />
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Space evenly</Label>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={!canDistribute}
              title={
                canDistribute
                  ? "Equal gaps left to right"
                  : "Select at least three items"
              }
              onClick={() => distributeSelected("horizontal")}
            >
              <AlignHorizontalDistributeCenter className="mr-2 h-4 w-4" />
              Across
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={!canDistribute}
              title={
                canDistribute
                  ? "Equal gaps top to bottom"
                  : "Select at least three items"
              }
              onClick={() => distributeSelected("vertical")}
            >
              <AlignVerticalDistributeCenter className="mr-2 h-4 w-4" />
              Down
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Match the first one you picked</Label>
          <div className="grid grid-cols-3 gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              title="Match its width"
              onClick={() => matchSizeSelected("width")}
            >
              <StretchHorizontal className="mr-1.5 h-3.5 w-3.5" />
              Width
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              title="Match its height"
              onClick={() => matchSizeSelected("height")}
            >
              <StretchVertical className="mr-1.5 h-3.5 w-3.5" />
              Height
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              title="Fit inside its box, proportions kept"
              onClick={() => matchSizeSelected("both")}
            >
              <Maximize2 className="mr-1.5 h-3.5 w-3.5" />
              Both
            </Button>
          </div>
        </div>

        <Separator />

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
          Drag on the canvas to move all selected items together. Locked items
          stay put. Select a single item to edit its properties.
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

  // The single-item panel lives in its own component so its hooks — including
  // useInspectorCommands, which needs a non-null item — are never called behind
  // the two early returns above. Keying on the item id resets the panel's own
  // state when the selection changes, no syncing effect needed.
  return (
    <SelectedItemInspector
      key={selectedItem.id}
      item={selectedItem}
      clipFolders={clipFolders}
      labelInputRef={labelInputRef}
    />
  );
}

function SelectedItemInspector({
  item,
  clipFolders,
  labelInputRef,
}: {
  item: OverlayItem;
  clipFolders: EditorInspectorProps["clipFolders"];
  labelInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { scene, updateItem, editorMode, pushHistory } = useOverlayStore();
  const def = getOverlayWidgetDefinition(item.type);
  const [sceneLayoutOpen, setSceneLayoutOpen] = useState(false);

  const {
    sceneW,
    sceneH,
    designSize,
    itemScale,
    cropInsets,
    isCropped,
    layoutTarget,
    layoutLocked,
    handleUpdate,
    setScalePercent,
    setRenderedWidth,
    setRenderedHeight,
    setCropInset,
    applyCrop,
    setDesignWidth,
    setDesignHeight,
    fit,
    align,
  } = useInspectorCommands(item, scene ?? null);

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
              <NumberField
                value={Math.round(item.x)}
                onFocus={() => pushHistory()}
                onCommit={(x) => handleUpdate({ x })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Y</Label>
              <NumberField
                value={Math.round(item.y)}
                onFocus={() => pushHistory()}
                onCommit={(y) => handleUpdate({ y })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Width</Label>
              <NumberField
                value={Math.round(item.w)}
                min={1}
                onFocus={() => pushHistory()}
                onCommit={setRenderedWidth}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Height</Label>
              <NumberField
                value={Math.round(item.h)}
                min={1}
                onFocus={() => pushHistory()}
                onCommit={setRenderedHeight}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Size</Label>
              <NumberField
                value={Math.round(itemScale * 100)}
                min={1}
                onFocus={() => pushHistory()}
                onCommit={setScalePercent}
                className="pr-6"
                adornment={
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    %
                  </span>
                }
              />
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
              <NumberField
                value={Math.round(designSize.w)}
                min={1}
                onFocus={() => pushHistory()}
                onCommit={setDesignWidth}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Frame height</Label>
              <NumberField
                value={Math.round(designSize.h)}
                min={1}
                onFocus={() => pushHistory()}
                onCommit={setDesignHeight}
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
                  <NumberField
                    min={0}
                    value={Math.round(cropInsets[edge])}
                    onFocus={() => pushHistory()}
                    onCommit={(inset) => setCropInset(edge, inset)}
                    className="px-2"
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
                        fit("scene");
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
                          fit("width");
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
                          fit("height");
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
                          align("left");
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
                          align("hcenter");
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
                          align("right");
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
                          align("top");
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
                          align("vcenter");
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
                          align("bottom");
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
                  <NumberField
                    value={item.rotation}
                    min={-360}
                    max={360}
                    onFocus={() => pushHistory()}
                    onCommit={(rotation) => handleUpdate({ rotation })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Z-Index</Label>
                  <NumberField
                    value={item.z_index}
                    onFocus={() => pushHistory()}
                    onCommit={(z_index) => handleUpdate({ z_index })}
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
