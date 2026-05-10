"use client";

import { Button } from "@/components/ui/button";
import { Database } from "@/types/supabase";
import {
  ArrowLeft,
  Info,
  LayoutGrid,
  Pause,
  Play,
  Save,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { saveAllOverlayItems } from "@/actions/overlays";
import type {
  OverlayItemConfig,
  OverlaySceneWithItems,
} from "@/types/overlays";
import { EditorCanvas } from "./editor-canvas";
import { EditorLayers } from "./editor-layers";
import { EditorInspector } from "./editor-inspector";
import { OverlayWidgetSheet } from "./overlay-widget-sheet";
import { useOverlayStore } from "./use-overlay-store";

interface OverlayEditorProps {
  initialScene: OverlaySceneWithItems;
  clipFolders: Database["public"]["Tables"]["clip_folders"]["Row"][];
}

export function OverlayEditor({ initialScene, clipFolders }: OverlayEditorProps) {
  const {
    scene,
    isDirty,
    zoom,
    setScene,
    setZoom,
    addItem,
    markClean,
    editorClipPreviewPaused,
    setEditorClipPreviewPaused,
    editorClipPreviewForceMute,
    setEditorClipPreviewForceMute,
    editorClipPreviewAutoplayBlocked,
    attemptEditorClipPreviewUnblock,
  } = useOverlayStore();
  const [isSaving, setIsSaving] = useState(false);
  const [widgetSheetOpen, setWidgetSheetOpen] = useState(false);

  useEffect(() => {
    setScene(initialScene);
  }, [initialScene, setScene]);

  const handleSave = useCallback(async () => {
    if (!scene) return;
    setIsSaving(true);

    const items = scene.items.map((item) => ({
      temp_id: item.id,
      id: item.id.startsWith("temp-") ? undefined : item.id,
      scene_id: scene.id,
      type: item.type,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      z_index: item.z_index,
      rotation: item.rotation,
      opacity: item.opacity,
      is_visible: item.is_visible,
      is_locked: item.is_locked,
      label: item.label,
      config: item.config as OverlayItemConfig,
    }));

    const { success, error, data } = await saveAllOverlayItems(scene.id, items);

    if (success) {
      toast.success("Overlay saved");
      markClean();
      if (data) setScene(data);
    } else {
      toast.error(error ?? "Failed to save");
    }

    setIsSaving(false);
  }, [scene, markClean, setScene]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  const hasClipsWidget = useMemo(
    () =>
      (scene?.items ?? []).some(
        (i) => i.type === "clips_widget" && i.is_visible !== false
      ),
    [scene]
  );

  const clipPreviewHintsNeeded =
    hasClipsWidget && editorClipPreviewAutoplayBlocked;

  const [clipPreviewHintsVisible, setClipPreviewHintsVisible] = useState(false);

  useEffect(() => {
    if (!clipPreviewHintsNeeded) {
      setClipPreviewHintsVisible(false);
      return;
    }
    setClipPreviewHintsVisible(true);
    const id = window.setTimeout(() => setClipPreviewHintsVisible(false), 5200);
    return () => window.clearTimeout(id);
  }, [clipPreviewHintsNeeded]);

  if (!scene) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] -m-5 md:-m-6">
      <div className="flex items-center justify-between border-b px-4 py-2 bg-background shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/overlays">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h2 className="font-semibold truncate max-w-[200px]">{scene.name}</h2>
          <span className="text-xs text-muted-foreground">
            {scene.width}x{scene.height}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border rounded-md p-0.5">
            {editorClipPreviewAutoplayBlocked ? (
              <Button
                variant="secondary"
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={() => attemptEditorClipPreviewUnblock()}
                title="Browser blocked autoplay — click to start preview"
              >
                <Play className="mr-1.5 h-3 w-3" />
                Allow playback
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() =>
                setEditorClipPreviewPaused(!editorClipPreviewPaused)
              }
              title={
                editorClipPreviewPaused
                  ? "Play clip preview in the editor"
                  : "Pause clip preview in the editor"
              }
            >
              {editorClipPreviewPaused ? (
                <Play className="h-3 w-3" />
              ) : (
                <Pause className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() =>
                setEditorClipPreviewForceMute(!editorClipPreviewForceMute)
              }
              title={
                editorClipPreviewForceMute
                  ? "Unmute clip preview (editor only; still respects saved clip mute in widget settings)"
                  : "Mute clip preview in the editor"
              }
            >
              {editorClipPreviewForceMute ? (
                <VolumeX className="h-3 w-3" />
              ) : (
                <Volume2 className="h-3 w-3" />
              )}
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setWidgetSheetOpen(true)}
            title="Open the widget library"
          >
            <LayoutGrid className="mr-2 h-3 w-3" />
            Widgets
          </Button>

          <div className="flex items-center gap-1 border rounded-md px-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom(zoom - 0.1)}
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
            <span className="text-xs w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom(zoom + 0.1)}
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
          </div>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
          >
            <Save className="mr-2 h-3 w-3" />
            {isSaving ? "Saving..." : isDirty ? "Save" : "Saved"}
          </Button>
        </div>
      </div>

      {clipPreviewHintsVisible && clipPreviewHintsNeeded ? (
        <div
          className="shrink-0 border-b border-border/60 bg-muted/35 px-3 py-1"
          role="status"
        >
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0 opacity-80" aria-hidden />
            <span>
              Autoplay was blocked—use{" "}
              <strong className="text-foreground/80">Allow playback</strong> or
              the play control in the header.
            </span>
          </p>
        </div>
      ) : null}

      <div className="flex flex-1 overflow-hidden">
        <div className="w-56 border-r overflow-y-auto shrink-0 bg-background">
          <EditorLayers />
        </div>

        <div className="flex-1 overflow-auto bg-muted/30">
          <EditorCanvas />
        </div>

        <div className="w-80 border-l overflow-y-auto shrink-0 bg-background">
          <EditorInspector clipFolders={clipFolders} />
        </div>
      </div>

      <OverlayWidgetSheet
        open={widgetSheetOpen}
        onOpenChange={setWidgetSheetOpen}
        onAddWidget={(type) => addItem(type)}
      />
    </div>
  );
}
