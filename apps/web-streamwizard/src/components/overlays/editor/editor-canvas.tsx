"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { OverlayItem, RootOverlayItemType } from "@/types/overlays";
import { asClipDisplayFieldConfig } from "@/types/overlays";
import {
  getRootOverlayWidgetDefinition,
  isRootLayerType,
} from "../registry/overlay-widget-registry";
import type { EditorClipPlaybackControls } from "../registry/overlay-widget-registry.types";
import { LayerContextMenu } from "./layer-context-menu";
import { computeSnap, type Guide } from "./snapping";
import { selectPrimarySelectedId, useOverlayStore } from "./use-overlay-store";

/** Screen-px snap radius; converted to scene px by dividing by zoom. */
const SNAP_THRESHOLD_PX = 8;
/** Screen-px movement before a background drag becomes a marquee (below = click-to-deselect). */
const MARQUEE_THRESHOLD_PX = 4;

interface DragItemStart {
  id: string;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
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
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  /** Pre-gesture items snapshot — pushed as one history entry on mouseup if geometry changed. */
  const gestureSnapshotRef = useRef<OverlayItem[] | null>(null);
  const movedRef = useRef(false);

  const toScenePoint = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (e.clientX - rect.left) / zoom,
        y: (e.clientY - rect.top) / zoom,
      };
    },
    [zoom]
  );

  const handleItemMouseDown = useCallback(
    (
      e: React.MouseEvent,
      itemId: string,
      mode: "move" | "resize",
      handle?: string
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
            !!i && !i.is_locked && (i.id === itemId || isRootLayerType(i.type))
        )
        .map((i) => ({
          id: i.id,
          startX: i.x,
          startY: i.y,
          startW: i.w,
          startH: i.h,
        }));
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
    [scene, selectedItemIds, selectItem, toggleSelectItem]
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
    [toScenePoint]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!scene) return;

      if (marquee) {
        const point = toScenePoint(e);
        const movedPx =
          Math.max(
            Math.abs(point.x - marquee.startX),
            Math.abs(point.y - marquee.startY)
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
        const grabbed = dragState.items.find((i) => i.id === dragState.grabbedId);
        if (grabbed && !e.altKey) {
          const draggedIds = new Set(dragState.items.map((i) => i.id));
          const targets = scene.items.filter(
            (i) =>
              isRootLayerType(i.type) &&
              i.is_visible &&
              !draggedIds.has(i.id)
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
            SNAP_THRESHOLD_PX / zoom
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
      } else if (dragState.mode === "resize") {
        const it = dragState.items[0]!;
        let newW = it.startW;
        let newH = it.startH;
        let newX = it.startX;
        let newY = it.startY;

        const handle = dragState.handle ?? "se";

        if (handle.includes("e")) newW = Math.max(50, it.startW + dx);
        if (handle.includes("s")) newH = Math.max(50, it.startH + dy);
        if (handle.includes("w")) {
          newW = Math.max(50, it.startW - dx);
          newX = it.startX + (it.startW - newW);
        }
        if (handle.includes("n")) {
          newH = Math.max(50, it.startH - dy);
          newY = it.startY + (it.startH - newH);
        }

        updateItem(it.id, {
          x: Math.round(newX),
          y: Math.round(newY),
          w: Math.round(newW),
          h: Math.round(newH),
        });
      }
    },
    [dragState, marquee, scene, zoom, updateItem, toScenePoint]
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
              i.y + i.h > y1
          )
          .map((i) => i.id);
        setSelectedItems(
          marquee.additive
            ? Array.from(new Set([...selectedItemIds, ...hit]))
            : hit
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
      isRootLayerType(i.type)
    )
    .sort((a, b) => a.z_index - b.z_index);

  const selected = scene.items.find((i) => i.id === primarySelectedId);

  const resizeHandles = ["nw", "ne", "sw", "se", "n", "s", "e", "w"];
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

  function getHandlePosition(handle: string) {
    const positions: Record<
      string,
      { top?: string; bottom?: string; left?: string; right?: string; transform: string }
    > = {
      nw: { top: "-4px", left: "-4px", transform: "none" },
      ne: { top: "-4px", right: "-4px", transform: "none" },
      sw: { bottom: "-4px", left: "-4px", transform: "none" },
      se: { bottom: "-4px", right: "-4px", transform: "none" },
      n: { top: "-4px", left: "50%", transform: "translateX(-50%)" },
      s: { bottom: "-4px", left: "50%", transform: "translateX(-50%)" },
      e: { top: "50%", right: "-4px", transform: "translateY(-50%)" },
      w: { top: "50%", left: "-4px", transform: "translateY(-50%)" },
    };
    return positions[handle] ?? { transform: "none" };
  }

  const marqueeRect =
    marquee?.active
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
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)
            `,
            backgroundSize: `${50 * zoom}px ${50 * zoom}px`,
          }}
        />

        <div className="absolute -top-6 left-0 text-xs text-muted-foreground">
          {scene.width} x {scene.height}
        </div>

        {sortedItems.map((item) => {
          if (!item.is_visible) return null;

          const def = getRootOverlayWidgetDefinition(item.type);
          const Canvas = def.CanvasContent;

          const childOfThis =
            selected?.type === "clip_display_field" &&
            asClipDisplayFieldConfig(selected.config).parentClipItemId === item.id;
          const isSelected = selectedItemIds.includes(item.id) || !!childOfThis;
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
                  left: item.x * zoom,
                  top: item.y * zoom,
                  width: item.w * zoom,
                  height: item.h * zoom,
                  zIndex: item.z_index,
                  opacity: item.opacity,
                  transform: item.rotation !== 0 ? `rotate(${item.rotation}deg)` : undefined,
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
                    w-full h-full rounded border-2 transition-colors overflow-hidden
                    ${isSelected ? "border-primary" : "border-white/20 hover:border-white/40"}
                  `}
                >
                  {Canvas ? (
                    <Canvas
                      item={item}
                      scene={scene}
                      zoom={zoom}
                      selectedItemId={primarySelectedId}
                      selected={selected}
                      selectItem={selectItem}
                      selectClipDisplayFieldForEdit={selectClipDisplayFieldForEdit}
                      updateItem={updateItem}
                      editorClipPlayback={editorClipPlayback}
                    />
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
                        style={{ fontSize: Math.max(10, 14 * zoom) }}
                      >
                        <div className="font-medium truncate">{item.label}</div>
                        <div
                          className="text-white/50 mt-0.5"
                          style={{ fontSize: Math.max(8, 10 * zoom) }}
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
                      const pos = getHandlePosition(handle);
                      return (
                        <div
                          key={handle}
                          className="absolute w-2 h-2 bg-primary border border-primary-foreground rounded-sm"
                          style={{
                            ...pos,
                            cursor: handleCursors[handle],
                            zIndex: 10,
                          }}
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
                    left: guide.position * zoom,
                    top: 0,
                    width: 1,
                    height: "100%",
                    zIndex: 9999,
                  }
                : {
                    top: guide.position * zoom,
                    left: 0,
                    height: 1,
                    width: "100%",
                    zIndex: 9999,
                  }
            }
          />
        ))}

        {marqueeRect && (
          <div
            className="absolute border border-primary bg-primary/10 pointer-events-none"
            style={{
              left: marqueeRect.x * zoom,
              top: marqueeRect.y * zoom,
              width: marqueeRect.w * zoom,
              height: marqueeRect.h * zoom,
              zIndex: 9999,
            }}
          />
        )}
      </div>
    </div>
  );
}
