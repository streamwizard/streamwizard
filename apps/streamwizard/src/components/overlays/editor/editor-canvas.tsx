"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { RootOverlayItemType } from "@/types/overlays";
import { asClipDisplayFieldConfig } from "@/types/overlays";
import {
  getRootOverlayWidgetDefinition,
  isRootLayerType,
} from "../registry/overlay-widget-registry";
import type { EditorClipPlaybackControls } from "../registry/overlay-widget-registry.types";
import { useOverlayStore } from "./use-overlay-store";

export function EditorCanvas() {
  const {
    scene,
    selectedItemId,
    zoom,
    selectItem,
    selectClipDisplayFieldForEdit,
    updateItem,
    editorClipPreviewPaused,
    setEditorClipPreviewPaused,
    editorClipPreviewForceMute,
    setEditorClipPreviewForceMute,
    editorClipPreviewAutoplayBlocked,
    setEditorClipPreviewAutoplayBlocked,
    editorClipPreviewResumeTick,
    bumpEditorClipPreviewResume,
  } = useOverlayStore();

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
  const [dragState, setDragState] = useState<{
    itemId: string;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    startItemX: number;
    startItemY: number;
    startItemW: number;
    startItemH: number;
    handle?: string;
  } | null>(null);

  const handleMouseDown = useCallback(
    (
      e: React.MouseEvent,
      itemId: string,
      mode: "move" | "resize",
      handle?: string
    ) => {
      e.stopPropagation();
      e.preventDefault();

      const item = scene?.items.find((i) => i.id === itemId);
      if (!item || item.is_locked) return;

      selectItem(itemId);

      setDragState({
        itemId,
        mode,
        startX: e.clientX,
        startY: e.clientY,
        startItemX: item.x,
        startItemY: item.y,
        startItemW: item.w,
        startItemH: item.h,
        handle,
      });
    },
    [scene, selectItem]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState || !scene) return;

      const dx = (e.clientX - dragState.startX) / zoom;
      const dy = (e.clientY - dragState.startY) / zoom;

      if (dragState.mode === "move") {
        const newX = Math.max(0, Math.min(scene.width, dragState.startItemX + dx));
        const newY = Math.max(0, Math.min(scene.height, dragState.startItemY + dy));
        updateItem(dragState.itemId, {
          x: Math.round(newX),
          y: Math.round(newY),
        });
      } else if (dragState.mode === "resize") {
        let newW = dragState.startItemW;
        let newH = dragState.startItemH;
        let newX = dragState.startItemX;
        let newY = dragState.startItemY;

        const handle = dragState.handle ?? "se";

        if (handle.includes("e")) newW = Math.max(50, dragState.startItemW + dx);
        if (handle.includes("s")) newH = Math.max(50, dragState.startItemH + dy);
        if (handle.includes("w")) {
          newW = Math.max(50, dragState.startItemW - dx);
          newX = dragState.startItemX + (dragState.startItemW - newW);
        }
        if (handle.includes("n")) {
          newH = Math.max(50, dragState.startItemH - dy);
          newY = dragState.startItemY + (dragState.startItemH - newH);
        }

        updateItem(dragState.itemId, {
          x: Math.round(newX),
          y: Math.round(newY),
          w: Math.round(newW),
          h: Math.round(newH),
        });
      }
    },
    [dragState, scene, zoom, updateItem]
  );

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  if (!scene) return null;

  const sortedItems = [...scene.items]
    .filter((i): i is typeof i & { type: RootOverlayItemType } =>
      isRootLayerType(i.type)
    )
    .sort((a, b) => a.z_index - b.z_index);

  const selected = scene.items.find((i) => i.id === selectedItemId);

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

  return (
    <div
      className="flex items-center justify-center p-8 min-h-full"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={() => selectItem(null)}
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
          const isSelected = selectedItemId === item.id || !!childOfThis;

          return (
            <div
              key={item.id}
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
                selectItem(item.id);
              }}
              onMouseDown={(e) => handleMouseDown(e, item.id, "move")}
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
                    selectedItemId={selectedItemId}
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

              {isSelected && !item.is_locked && (
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
                          handleMouseDown(e, item.id, "resize", handle)
                        }
                      />
                    );
                  })}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
