"use client";

import { captureEvent } from "@repo/posthog";
import { Button } from "@repo/ui";
import { Database } from "@repo/supabase";
import { useDemoFire } from "@/hooks/overlays/use-demo-fire";
import {
  ArrowLeft,
  Copy,
  FlaskConical,
  Info,
  Keyboard,
  LayoutGrid,
  Pause,
  Play,
  Redo2,
  Save,
  Undo2,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { saveAllOverlayItems } from "@/actions/overlays/items";
import type { Widget } from "@/actions/widgets";
import {
  getCachedWidget,
  primeWidgetCache,
} from "@/components/overlays/widgets/custom/widget-cache";
import { DemoEventPanel } from "@/components/demo/demo-event-panel";
import { env } from "@/lib/env";
import { asCustomWidgetConfig } from "@/types/overlays";
import type {
  OverlayItemConfig,
  OverlaySceneWithItems,
} from "@/types/overlays";
import { EditorCanvas } from "./editor-canvas";
import { EditorLayers } from "./editor-layers";
import { EditorInspector } from "./editor-inspector";
import { OverlayWidgetSheet } from "./overlay-widget-sheet";
import { WidgetLibraryModal } from "./widget-library-modal";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { useOverlayStore } from "@/stores/overlay-editor-store";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { UnsavedChangesDialog } from "@/components/modals/unsaved-changes-dialog";
import { useOverlayDraft } from "@/hooks/overlays/use-overlay-draft";
import { RestoreDraftDialog } from "./restore-draft-dialog";

interface OverlayEditorProps {
  initialScene: OverlaySceneWithItems;
  clipFolders: Database["public"]["Tables"]["clip_folders"]["Row"][];
  /** Widget rows for the scene's custom widgets, fetched with the page. */
  initialWidgets: Widget[];
}

/**
 * Radix renders dialogs, sheets, menus and popovers into a portal on `body`, so
 * a button inside one reaches a `window` keydown listener exactly like the
 * canvas does. Editing shortcuts must not act on the scene behind them.
 */
const OVERLAY_SURFACE_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]';

export function OverlayEditor({ initialScene, clipFolders, initialWidgets }: OverlayEditorProps) {
  // Before first render, so the canvas never has to fetch what the page already
  // loaded.
  useState(() => primeWidgetCache(initialWidgets));

  const {
    scene,
    isDirty,
    zoom,
    setScene,
    setZoom,
    addItem,
    addCustomWidget,
    markClean,
    setSelectedItems,
    history,
    undo,
    redo,
    clearSelection,
    removeSelectedItems,
    duplicateSelectedItems,
    nudgeSelected,
    editorClipPreviewPaused,
    setEditorClipPreviewPaused,
    editorClipPreviewForceMute,
    setEditorClipPreviewForceMute,
    editorClipPreviewAutoplayBlocked,
    attemptEditorClipPreviewUnblock,
    editorMode,
    setEditorMode,
    runningSimulatorIds,
    setRunningSimulatorIds,
  } = useOverlayStore();
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { requestLeave, dialogProps: unsavedDialogProps } =
    useUnsavedChangesGuard(isDirty);
  const draftPrompt = useOverlayDraft(initialScene);
  const [widgetSheetOpen, setWidgetSheetOpen] = useState(false);
  const [widgetLibraryOpen, setWidgetLibraryOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Shared with the alert inspector's Test buttons: one switch, one delivery.
  const { mode: demoFireMode, setMode: setDemoFireMode, fire: fireDemo } = useDemoFire();

  // Every custom widget's source, concatenated, so the demo picker can lead
  // with the events anything on this canvas actually listens for. The cache is
  // primed before first render, so this needs no fetch.
  const canvasWidgetJs = useMemo(
    () =>
      (scene?.items ?? [])
        .filter((item) => item.type === "custom_widget")
        .map((item) => getCachedWidget(asCustomWidgetConfig(item.config).widget_id)?.js ?? "")
        .join("\n"),
    [scene?.items]
  );

  // Saving revalidates, so Next hands us a brand-new `initialScene` object for
  // the scene we're already editing. Re-seeding on that would throw away the
  // selection and the undo history right after every save, so only seed when
  // the editor is actually pointed at a different scene.
  const seededSceneId = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (seededSceneId.current === initialScene.id) return;
    seededSceneId.current = initialScene.id;
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
      design_w: item.design_w,
      design_h: item.design_h,
      crop_top: item.crop_top,
      crop_right: item.crop_right,
      crop_bottom: item.crop_bottom,
      crop_left: item.crop_left,
      z_index: item.z_index,
      rotation: item.rotation,
      opacity: item.opacity,
      is_visible: item.is_visible,
      is_locked: item.is_locked,
      label: item.label,
      config: item.config as OverlayItemConfig,
    }));

    const { success, error, data, idMap } = await saveAllOverlayItems(scene.id, items);

    if (success) {
      toast.success("Overlay saved");
      markClean();
      if (data) {
        // Newly inserted items trade their temp-N id for a DB one; point the
        // selection at the new ids first so setScene keeps the inspector open
        // on whatever the streamer was configuring.
        setSelectedItems(
          useOverlayStore
            .getState()
            .selectedItemIds.map((id) => idMap[id] ?? id)
        );
        setScene(data, { idMap });
      }
    } else {
      toast.error(error ?? "Failed to save");
    }

    setIsSaving(false);
  }, [scene, markClean, setScene, setSelectedItems]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
        return;
      }

      // Editing shortcuts stay dead while typing.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
      ) {
        return;
      }

      // An overlay owns the keyboard whenever focus is inside one, or -- for a
      // modal, which marks everything outside it aria-hidden -- whenever focus
      // never entered it at all.
      const inOverlay =
        !!t?.closest(OVERLAY_SURFACE_SELECTOR) ||
        !!rootRef.current?.closest('[data-aria-hidden="true"]');

      // ? toggles the reference, checked ahead of the overlay guard so the
      // dialog it opens can't swallow the key that closes it again. Any other
      // overlay still wins: ? on top of the widget sheet does nothing.
      if (e.key === "?" && (shortcutsOpen || !inOverlay)) {
        e.preventDefault();
        setShortcutsOpen((open) => !open);
        return;
      }

      // Editing shortcuts stay out of it. Escape reaches Radix either way, so
      // it still closes the overlay before the next one clears the selection.
      if (inOverlay) return;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      // Ctrl+Y is the Windows redo convention; Cmd+Y is a Finder shortcut, not
      // a browser one, so the same branch is safe on macOS.
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelectedItems();
        return;
      }
      if (e.key === "Escape") {
        // Radix overlays handle their own Escape and preventDefault it.
        if (!e.defaultPrevented) clearSelection();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeSelectedItems();
        return;
      }
      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        nudgeSelected(
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0,
          e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0
        );
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleSave,
    shortcutsOpen,
    undo,
    redo,
    clearSelection,
    removeSelectedItems,
    duplicateSelectedItems,
    nudgeSelected,
  ]);

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
    <div ref={rootRef} className="flex flex-col h-[calc(100vh-80px)] -m-5 md:-m-6">
      <div className="flex items-center justify-between border-b px-4 py-2 bg-background shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => requestLeave(() => router.push("/dashboard/overlays"))}
            title="Back to your overlays"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="font-semibold truncate max-w-[200px]">{scene.name}</h2>
          <span className="text-xs text-muted-foreground">
            {scene.width}x{scene.height}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Simple keeps the calm layout for new users; Pro shows everything */}
          <div className="flex items-center border rounded-md p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setEditorMode("simple")}
              className={`px-2 py-1 rounded transition-colors ${
                editorMode === "simple" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Fewer panels, the essentials only"
            >
              Simple
            </button>
            <button
              type="button"
              onClick={() => setEditorMode("pro")}
              className={`px-2 py-1 rounded transition-colors ${
                editorMode === "pro" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Full editor with layers panel"
            >
              Pro
            </button>
          </div>

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
            variant={demoOpen ? "secondary" : "outline"}
            size="sm"
            onClick={() => setDemoOpen((v) => !v)}
            title="Feed fake events to every widget on this canvas"
          >
            <FlaskConical className="mr-2 h-3 w-3" />
            Demo
            {runningSimulatorIds.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 text-[10px] leading-4 text-primary">
                {runningSimulatorIds.length}
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setWidgetSheetOpen(true)}
            title="Open the widget library"
          >
            <LayoutGrid className="mr-2 h-3 w-3" />
            Widgets
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShortcutsOpen(true)}
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="h-3 w-3" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const url = `${env.NEXT_PUBLIC_OVERLAY_URL}/${scene.slug}`;
              navigator.clipboard.writeText(url);
              toast.success("Overlay URL copied");
            }}
            title="Copy OBS browser source URL"
          >
            <Copy className="mr-2 h-3 w-3" />
            Copy URL
          </Button>

          <div className="flex items-center gap-1 border rounded-md p-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => undo()}
              disabled={history.past.length === 0}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => redo()}
              disabled={history.future.length === 0}
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="h-3 w-3" />
            </Button>
          </div>

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

      {/* Kept mounted and hidden with CSS rather than unmounted: collapsing the
          panel must not stop a running simulator, and the payload editor keeps
          its scroll position. Live needs no socket of our own -- the server
          action broadcasts through ws-server -- so wsConnected stays undefined. */}
      <div className={demoOpen ? undefined : "hidden"}>
        <DemoEventPanel
          storageId={scene.id}
          sourceJs={canvasWidgetJs}
          mode={demoFireMode}
          onModeChange={setDemoFireMode}
          onFire={fireDemo}
          onRunningSimulatorsChange={setRunningSimulatorIds}
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {editorMode === "pro" && (
          <div className="w-56 border-r overflow-y-auto shrink-0 bg-background">
            <EditorLayers />
          </div>
        )}

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
        onAddWidget={(type) => {
          captureEvent("widget_added", { widget: type, custom: false });
          addItem(type);
        }}
        onOpenLibrary={() => setWidgetLibraryOpen(true)}
      />

      <WidgetLibraryModal
        open={widgetLibraryOpen}
        onOpenChange={setWidgetLibraryOpen}
        onAddToCanvas={(widgetId) => {
          captureEvent("widget_added", { custom: true });
          addCustomWidget(widgetId);
        }}
      />

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      <UnsavedChangesDialog {...unsavedDialogProps} />

      <RestoreDraftDialog {...draftPrompt} />
    </div>
  );
}
