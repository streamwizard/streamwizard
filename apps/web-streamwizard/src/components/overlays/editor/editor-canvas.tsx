"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OverlayItem, RootOverlayItemType } from "@/types/overlays";
import { asClipDisplayFieldConfig } from "@/types/overlays";
import {
  getRootOverlayWidgetDefinition,
  isRootLayerType,
} from "../registry/overlay-widget-registry";
import type { EditorClipPlaybackControls } from "../registry/overlay-widget-registry.types";
import { LayerContextMenu } from "./layer-context-menu";
import { computeSnap, type Guide } from "./snapping";
import {
  MIN_ITEM_SIZE,
  selectPrimarySelectedId,
  useOverlayStore,
} from "./use-overlay-store";
import {
  WidgetScaleFrame,
  clampCrop,
  clampScale,
  getCropInsets,
  getDesignSize,
  getItemScale,
  type CropInsets,
} from "@repo/ui/overlay";

/** Screen-px snap radius; converted to scene px by dividing by zoom. */
const SNAP_THRESHOLD_PX = 8;
/** Screen-px movement before a background drag becomes a marquee (below = click-to-deselect). */
const MARQUEE_THRESHOLD_PX = 4;
/** On-screen size of a resize handle; divided by zoom because the canvas is scaled. */
const HANDLE_SIZE_PX = 8;

const RESIZE_HINT =
  "Drag to resize the whole widget, contents included. Hold Alt to crop instead.";
const REFLOW_HINT =
  "Drag to resize the frame only — text keeps its size (Shift on a corner for both, Alt to crop)";
const CROP_HINT =
  "Drag to crop this edge away. Then resize normally to stretch what's left back out.";

interface DragItemStart {
  id: string;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  startDesignW: number;
  startDesignH: number;
  startCrop: CropInsets;
  startScale: number;
}

interface DragState {
  mode: "move" | "resize";
  /** The item the pointer went down on — snapping references its rect. */
  grabbedId: string;
  pointerStartX: number;
  pointerStartY: number;
  items: DragItemStart[];
  handle?: string;
}

interface MarqueeState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  active: boolean;
  additive: boolean;
}

export function EditorCanvas() {
  const {
    scene,
    selectedItemIds,
    zoom,
    selectItem,
    toggleSelectItem,
    setSelectedItems,
    clearSelection,
    selectClipDisplayFieldForEdit,
    updateItem,
    pushHistory,
    setRenameRequestId,
    editorClipPreviewPaused,
    setEditorClipPreviewPaused,
    editorClipPreviewForceMute,
    setEditorClipPreviewForceMute,
    editorClipPreviewAutoplayBlocked,
    setEditorClipPreviewAutoplayBlocked,
    editorClipPreviewResumeTick,
    bumpEditorClipPreviewResume,
  } = useOverlayStore();

  const primarySelectedId = selectPrimarySelectedId({ selectedItemIds });

  const editorClipPlayback = useMemo<EditorClipPlaybackControls>(
    () => ({
      previewPaused: editorClipPreviewPaused,
      setPreviewPaused: setEditorClipPreviewPaused,
      previewForceMute: editorClipPreviewForceMute,
      setPreviewForceMute: setEditorClipPreviewForceMute,
      autoplayBlocked: editorClipPreviewAutoplayBlocked,
      setAutoplayBlocked: setEditorClipPreviewAutoplayBlocked,
      resumeTick: editorClipPreviewResumeTick,
      bumpResumePlayback: bumpEditorClipPreviewResume,
    }),
    [
      editorClipPreviewPaused,
      setEditorClipPreviewPaused,
      editorClipPreviewForceMute,
      setEditorClipPreviewForceMute,
      editorClipPreviewAutoplayBlocked,
      setEditorClipPreviewAutoplayBlocked,
      editorClipPreviewResumeTick,
      bumpEditorClipPreviewResume,
    ],
  );

  const canvasRef = useRef<HTMLDivElement>(null);
  /** Alt re-purposes the resize handles as crop handles; tracked so they can say so. */
  const [cropModifier, setCropModifier] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  /** Pre-gesture items snapshot — pushed as one history entry on mouseup if geometry changed. */
  const gestureSnapshotRef = useRef<OverlayItem[] | null>(null);
  const movedRef = useRef(false);

  useEffect(() => {
    const sync = (e: KeyboardEvent) => setCropModifier(e.altKey);
    // Alt-tabbing away leaves keyup unheard, so drop the state on blur too.
    const clear = () => setCropModifier(false);
    window.addEventListener("keydown", sync);
    window.addEventListener("keyup", sync);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", sync);
      window.removeEventListener("keyup", sync);
      window.removeEventListener("blur", clear);
    };
  }, []);

  const toScenePoint = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (e.clientX - rect.left) / zoom,
        y: (e.clientY - rect.top) / zoom,
      };
    },
    [zoom],
  );

  const handleItemMouseDown = useCallback(
    (
      e: React.MouseEvent,
      itemId: string,
      mode: "move" | "resize",
      handle?: string,
    ) => {
      if (e.button !== 0) return; // right-click opens the context menu, never a drag
      e.stopPropagation();
      e.preventDefault();

      if (!scene) return;
      const item = scene.items.find((i) => i.id === itemId);
      if (!item) return;

      if (e.shiftKey && mode === "move" && isRootLayerType(item.type)) {
        toggleSelectItem(itemId);
        return;
      }

      // Locked items are selectable but never draggable.
      if (item.is_locked) {
        if (!selectedItemIds.includes(itemId)) selectItem(itemId);
        return;
      }

      const inSelection = selectedItemIds.includes(itemId);
      if (!inSelection) selectItem(itemId);

      // Group move when grabbing a member of a multi-selection; resize is always single-item.
      const groupIds =
        mode === "move" && inSelection && selectedItemIds.length > 1
          ? selectedItemIds
          : [itemId];
      const items: DragItemStart[] = groupIds
        .map((id) => scene.items.find((i) => i.id === id))
        .filter(
          (i): i is OverlayItem =>
            !!i && !i.is_locked && (i.id === itemId || isRootLayerType(i.type)),
        )
        .map((i) => {
          const design = getDesignSize(i);
          return {
            id: i.id,
            startX: i.x,
            startY: i.y,
            startW: i.w,
            startH: i.h,
            startDesignW: design.w,
            startDesignH: design.h,
            startCrop: getCropInsets(i),
            startScale: getItemScale(i),
          };
        });
      if (items.length === 0) return;

      gestureSnapshotRef.current = scene.items;
      movedRef.current = false;
      setDragState({
        mode,
        grabbedId: itemId,
        pointerStartX: e.clientX,
        pointerStartY: e.clientY,
        items,
        handle,
      });
    },
    [scene, selectedItemIds, selectItem, toggleSelectItem],
  );

  const handleBackgroundMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const point = toScenePoint(e);
      setMarquee({
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
        active: false,
        additive: e.shiftKey,
      });
    },
    [toScenePoint],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!scene) return;

      if (marquee) {
        const point = toScenePoint(e);
        const movedPx =
          Math.max(
            Math.abs(point.x - marquee.startX),
            Math.abs(point.y - marquee.startY),
          ) * zoom;
        setMarquee({
          ...marquee,
          currentX: point.x,
          currentY: point.y,
          active: marquee.active || movedPx > MARQUEE_THRESHOLD_PX,
        });
        return;
      }

      if (!dragState) return;

      const dx = (e.clientX - dragState.pointerStartX) / zoom;
      const dy = (e.clientY - dragState.pointerStartY) / zoom;
      if (dx !== 0 || dy !== 0) movedRef.current = true;

      if (dragState.mode === "move") {
        // Clamp the delta at gesture level so a group keeps its relative layout.
        let minDx = -Infinity;
        let maxDx = Infinity;
        let minDy = -Infinity;
        let maxDy = Infinity;
        for (const it of dragState.items) {
          minDx = Math.max(minDx, -it.startX);
          maxDx = Math.min(maxDx, scene.width - it.startX - it.startW);
          minDy = Math.max(minDy, -it.startY);
          maxDy = Math.min(maxDy, scene.height - it.startY - it.startH);
        }
        let cdx = Math.min(Math.max(dx, minDx), maxDx);
        let cdy = Math.min(Math.max(dy, minDy), maxDy);

        // Snap using the grabbed item's rect; Alt disables.
        const grabbed = dragState.items.find(
          (i) => i.id === dragState.grabbedId,
        );
        if (grabbed && !e.altKey) {
          const draggedIds = new Set(dragState.items.map((i) => i.id));
          const targets = scene.items.filter(
            (i) =>
              isRootLayerType(i.type) && i.is_visible && !draggedIds.has(i.id),
          );
          const snapped = computeSnap(
            {
              x: grabbed.startX + cdx,
              y: grabbed.startY + cdy,
              w: grabbed.startW,
              h: grabbed.startH,
            },
            targets,
            scene,
            SNAP_THRESHOLD_PX / zoom,
          );
          const snapDx = snapped.x - (grabbed.startX + cdx);
          const snapDy = snapped.y - (grabbed.startY + cdy);
          // Only accept a snap that keeps the whole group in bounds.
          if (cdx + snapDx >= minDx && cdx + snapDx <= maxDx) cdx += snapDx;
          if (cdy + snapDy >= minDy && cdy + snapDy <= maxDy) cdy += snapDy;
          setGuides(snapped.guides);
        } else {
          setGuides([]);
        }

        for (const it of dragState.items) {
          updateItem(it.id, {
            x: Math.round(it.startX + cdx),
            y: Math.round(it.startY + cdy),
          });
        }
      } else if (dragState.mode === "resize" && e.altKey) {
        // Alt turns the handles into crop handles: the scale stays put and the
        // box shrinks as content is cropped away, so the visible content never
        // moves under the cursor. Crop in, then drag normally to stretch the
        // remaining slice back up — that is a zoom that stays on the canvas.
        const it = dragState.items[0]!;
        const handle = dragState.handle ?? "se";
        const design = { w: it.startDesignW, h: it.startDesignH };

        // Pointer travel expressed in design px.
        const ddx = dx / it.startScale;
        const ddy = dy / it.startScale;

        const next = { ...it.startCrop };
        if (handle.includes("e")) next.right = it.startCrop.right - ddx;
        if (handle.includes("w")) next.left = it.startCrop.left + ddx;
        if (handle.includes("s")) next.bottom = it.startCrop.bottom - ddy;
        if (handle.includes("n")) next.top = it.startCrop.top + ddy;

        const crop = clampCrop(next, design);
        const newW = (design.w - crop.left - crop.right) * it.startScale;
        const newH = (design.h - crop.top - crop.bottom) * it.startScale;

        // Cropping from the left/top shrinks the box from that side, so the
        // content that survives stays exactly where it was on screen.
        const newX = handle.includes("w")
          ? it.startX + (it.startW - newW)
          : it.startX;
        const newY = handle.includes("n")
          ? it.startY + (it.startH - newH)
          : it.startY;

        updateItem(it.id, {
          x: Math.round(newX),
          y: Math.round(newY),
          w: Math.round(newW),
          h: Math.round(newH),
          crop_top: crop.top,
          crop_right: crop.right,
          crop_bottom: crop.bottom,
          crop_left: crop.left,
        });
      } else if (dragState.mode === "resize") {
        const it = dragState.items[0]!;
        const handle = dragState.handle ?? "se";
        const isCorner = handle.length === 2;
        // Corners scale the widget and everything in it; edges only reflow the
        // frame, which is how you widen a text box without growing the text.
        const uniform = isCorner && !e.shiftKey;

        let newW = it.startW;
        let newH = it.startH;
        let newX = it.startX;
        let newY = it.startY;
        let newDesignW = it.startDesignW;
        let newDesignH = it.startDesignH;

        // The box shows the cropped slice, not the whole design box, so all the
        // scale maths works off the source region.
        const sourceW = it.startDesignW - it.startCrop.left - it.startCrop.right;
        const sourceH = it.startDesignH - it.startCrop.top - it.startCrop.bottom;

        if (uniform) {
          // Take whichever axis the pointer moved furthest along so the drag
          // tracks the cursor on the dominant direction.
          const signedDx = handle.includes("w") ? -dx : dx;
          const signedDy = handle.includes("n") ? -dy : dy;
          const byW = (it.startW + signedDx) / it.startW;
          const byH = (it.startH + signedDy) / it.startH;
          const ratio = Math.abs(signedDx) >= Math.abs(signedDy) ? byW : byH;
          const scale = clampScale(it.startScale * ratio);
          newW = Math.max(MIN_ITEM_SIZE, sourceW * scale);
          newH = Math.max(MIN_ITEM_SIZE, sourceH * scale);
        } else {
          // Reflow grows the design box; the crop insets ride along unchanged,
          // so the extra room lands in the visible slice.
          if (handle.includes("e") || handle.includes("w")) {
            const delta = handle.includes("w") ? -dx : dx;
            newW = Math.max(MIN_ITEM_SIZE, it.startW + delta);
            newDesignW =
              newW / it.startScale + it.startCrop.left + it.startCrop.right;
          }
          if (handle.includes("s") || handle.includes("n")) {
            const delta = handle.includes("n") ? -dy : dy;
            newH = Math.max(MIN_ITEM_SIZE, it.startH + delta);
            newDesignH =
              newH / it.startScale + it.startCrop.top + it.startCrop.bottom;
          }
        }

        // Dragging a west/north edge keeps the opposite side pinned.
        if (handle.includes("w")) newX = it.startX + (it.startW - newW);
        if (handle.includes("n")) newY = it.startY + (it.startH - newH);

        updateItem(it.id, {
          x: Math.round(newX),
          y: Math.round(newY),
          w: Math.round(newW),
          h: Math.round(newH),
          design_w: newDesignW,
          design_h: newDesignH,
        });
      }
    },
    [dragState, marquee, scene, zoom, updateItem, toScenePoint],
  );

  const handleMouseUp = useCallback(() => {
    if (marquee && scene) {
      if (marquee.active) {
        const x1 = Math.min(marquee.startX, marquee.currentX);
        const y1 = Math.min(marquee.startY, marquee.currentY);
        const x2 = Math.max(marquee.startX, marquee.currentX);
        const y2 = Math.max(marquee.startY, marquee.currentY);
        const hit = scene.items
          .filter(
            (i) =>
              isRootLayerType(i.type) &&
              i.is_visible &&
              !i.is_locked &&
              i.x < x2 &&
              i.x + i.w > x1 &&
              i.y < y2 &&
              i.y + i.h > y1,
          )
          .map((i) => i.id);
        setSelectedItems(
          marquee.additive
            ? Array.from(new Set([...selectedItemIds, ...hit]))
            : hit,
        );
      } else if (!marquee.additive) {
        clearSelection();
      }
      setMarquee(null);
      return;
    }

    if (dragState) {
      if (movedRef.current && gestureSnapshotRef.current) {
        pushHistory(gestureSnapshotRef.current); // one undo entry per drag/resize gesture
      } else if (!movedRef.current && selectedItemIds.length > 1) {
        // Plain click (no drag) on a multi-selected item collapses to that item.
        selectItem(dragState.grabbedId);
      }
      gestureSnapshotRef.current = null;
      movedRef.current = false;
      setDragState(null);
      setGuides([]);
    }
  }, [
    marquee,
    dragState,
    scene,
    selectedItemIds,
    setSelectedItems,
    selectItem,
    clearSelection,
    pushHistory,
  ]);

  if (!scene) return null;

  const sortedItems = [...scene.items]
    .filter((i): i is typeof i & { type: RootOverlayItemType } =>
      isRootLayerType(i.type),
    )
    .sort((a, b) => a.z_index - b.z_index);

  const selected = scene.items.find((i) => i.id === primarySelectedId);

  // Mid-gesture the mode is already fixed, so only advertise crop when idle.
  const cropping = cropModifier && !dragState;

  const resizeHandles = ["nw", "ne", "sw", "se", "n", "s", "e", "w"];
  const handleHints: Record<string, string> = {
    nw: RESIZE_HINT,
    ne: RESIZE_HINT,
    sw: RESIZE_HINT,
    se: RESIZE_HINT,
    n: REFLOW_HINT,
    s: REFLOW_HINT,
    e: REFLOW_HINT,
    w: REFLOW_HINT,
  };
  const handleCursors: Record<string, string> = {
    nw: "nwse-resize",
    ne: "nesw-resize",
    sw: "nesw-resize",
    se: "nwse-resize",
    n: "ns-resize",
    s: "ns-resize",
    e: "ew-resize",
    w: "ew-resize",
  };

  function getHandlePosition(handle: string, z: number) {
    const off = `${-(HANDLE_SIZE_PX / 2) / z}px`;
    const positions: Record<
      string,
      {
        top?: string;
        bottom?: string;
        left?: string;
        right?: string;
        transform: string;
      }
    > = {
      nw: { top: off, left: off, transform: "none" },
      ne: { top: off, right: off, transform: "none" },
      sw: { bottom: off, left: off, transform: "none" },
      se: { bottom: off, right: off, transform: "none" },
      n: { top: off, left: "50%", transform: "translateX(-50%)" },
      s: { bottom: off, left: "50%", transform: "translateX(-50%)" },
      e: { top: "50%", right: off, transform: "translateY(-50%)" },
      w: { top: "50%", left: off, transform: "translateY(-50%)" },
    };
    return positions[handle] ?? { transform: "none" };
  }

  const marqueeRect = marquee?.active
    ? {
        x: Math.min(marquee.startX, marquee.currentX),
        y: Math.min(marquee.startY, marquee.currentY),
        w: Math.abs(marquee.currentX - marquee.startX),
        h: Math.abs(marquee.currentY - marquee.startY),
      }
    : null;

  return (
    <div
      className="flex items-center justify-center p-8 min-h-full"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseDown={handleBackgroundMouseDown}
    >
      <div
        ref={canvasRef}
        className="relative bg-black/90 shadow-2xl border border-border/50"
        style={{
          width: scene.width * zoom,
          height: scene.height * zoom,
        }}
      >
        <div className="absolute -top-6 left-0 text-xs text-muted-foreground">
          {scene.width} x {scene.height}
        </div>

        {/*
          Everything inside renders in raw scene px and is scaled once here, so
          the editor is a true-to-size preview of the live overlay. Selection
          chrome divides its px by `zoom` to stay a constant size on screen.
        */}
        <div
          className="relative"
          style={{
            width: scene.width,
            height: scene.height,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
          }}
        >
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
              linear-gradient(rgba(255,255,255,.1) ${1 / zoom}px, transparent ${1 / zoom}px),
              linear-gradient(90deg, rgba(255,255,255,.1) ${1 / zoom}px, transparent ${1 / zoom}px)
            `,
              backgroundSize: "50px 50px",
            }}
          />

          {sortedItems.map((item) => {
            if (!item.is_visible) return null;

            const def = getRootOverlayWidgetDefinition(item.type);
            const Canvas = def.CanvasContent;

            const childOfThis =
              selected?.type === "clip_display_field" &&
              asClipDisplayFieldConfig(selected.config).parentClipItemId ===
                item.id;
            const isSelected =
              selectedItemIds.includes(item.id) || !!childOfThis;
            const showHandles =
              isSelected &&
              !item.is_locked &&
              (selectedItemIds.length <= 1 || !!childOfThis);

            return (
              <LayerContextMenu
                key={item.id}
                item={item}
                onRename={() => {
                  selectItem(item.id);
                  setRenameRequestId(item.id);
                }}
              >
                <div
                  className="absolute group"
                  style={{
                    left: item.x,
                    top: item.y,
                    width: item.w,
                    height: item.h,
                    zIndex: item.z_index,
                    opacity: item.opacity,
                    transform:
                      item.rotation !== 0
                        ? `rotate(${item.rotation}deg)`
                        : undefined,
                    cursor: item.is_locked ? "not-allowed" : "move",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  onContextMenu={() => {
                    if (!selectedItemIds.includes(item.id)) selectItem(item.id);
                  }}
                  onMouseDown={(e) => handleItemMouseDown(e, item.id, "move")}
                >
                  <div
                    className={`
                    w-full h-full border-solid transition-colors overflow-hidden
                    ${isSelected ? "border-primary" : "border-white/20 hover:border-white/40"}
                  `}
                    style={{ borderWidth: 2 / zoom, borderRadius: 4 / zoom }}
                  >
                    {Canvas ? (
                      <WidgetScaleFrame item={item}>
                        <Canvas
                          item={item}
                          scene={scene}
                          screenScale={zoom * getItemScale(item)}
                          selectedItemId={primarySelectedId}
                          selected={selected}
                          selectItem={selectItem}
                          selectClipDisplayFieldForEdit={
                            selectClipDisplayFieldForEdit
                          }
                          updateItem={updateItem}
                          editorClipPlayback={editorClipPlayback}
                        />
                      </WidgetScaleFrame>
                    ) : (
                      <div
                        className="w-full h-full flex flex-col items-center justify-center"
                        style={{
                          background: "rgba(99, 102, 241, 0.15)",
                          backdropFilter: "blur(4px)",
                        }}
                      >
                        <div
                          className="text-white/80 text-center px-2"
                          style={{ fontSize: Math.max(10 / zoom, 14) }}
                        >
                          <div className="font-medium truncate">
                            {item.label}
                          </div>
                          <div
                            className="text-white/50 mt-0.5"
                            style={{ fontSize: Math.max(8 / zoom, 10) }}
                          >
                            {item.type}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {showHandles && (
                    <>
                      {resizeHandles.map((handle) => {
                        const pos = getHandlePosition(handle, zoom);
                        return (
                          <div
                            key={handle}
                            className={`absolute border-solid border-primary-foreground ${
                              cropping ? "bg-amber-400" : "bg-primary"
                            }`}
                            style={{
                              ...pos,
                              width: HANDLE_SIZE_PX / zoom,
                              height: HANDLE_SIZE_PX / zoom,
                              borderWidth: 1 / zoom,
                              borderRadius: cropping ? 0 : 2 / zoom,
                              cursor: handleCursors[handle],
                              zIndex: 10,
                            }}
                            title={cropping ? CROP_HINT : handleHints[handle]}
                            onMouseDown={(e) =>
                              handleItemMouseDown(e, item.id, "resize", handle)
                            }
                          />
                        );
                      })}
                    </>
                  )}
                </div>
              </LayerContextMenu>
            );
          })}

          {guides.map((guide, idx) => (
            <div
              key={`${guide.orientation}-${guide.position}-${idx}`}
              className="absolute bg-primary/70 pointer-events-none"
              style={
                guide.orientation === "v"
                  ? {
                      left: guide.position,
                      top: 0,
                      width: 1 / zoom,
                      height: "100%",
                      zIndex: 9999,
                    }
                  : {
                      top: guide.position,
                      left: 0,
                      height: 1 / zoom,
                      width: "100%",
                      zIndex: 9999,
                    }
              }
            />
          ))}

          {marqueeRect && (
            <div
              className="absolute border-solid border-primary bg-primary/10 pointer-events-none"
              style={{
                left: marqueeRect.x,
                top: marqueeRect.y,
                width: marqueeRect.w,
                height: marqueeRect.h,
                borderWidth: 1 / zoom,
                zIndex: 9999,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
