"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useOverlayStore } from "@/stores/overlay-editor-store";
import { focalPanCorrection, wheelZoom } from "@/components/overlays/editor/canvas-zoom";

/** A scene point to hold under the cursor once the next zoom has been laid out. */
interface FocalRequest {
  clientX: number;
  clientY: number;
  sceneX: number;
  sceneY: number;
}

interface CanvasViewportOptions {
  /** The scaled canvas box, the same ref the gesture code measures. */
  canvasRef: React.RefObject<HTMLDivElement | null>;
  /** The scrolling pane the canvas sits in; wheel events are bound here. */
  paneRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Wheel zoom, cursor-anchored zoom and panning for the editor canvas.
 *
 * The canvas is flex-centred inside a scrolling pane, so where it lands after a
 * zoom is not knowable in advance. Zoom is therefore applied first and the pan
 * corrected in a layout effect, once the new rect can be measured — one pass,
 * before paint, so the focal point never visibly slips.
 */
export function useCanvasViewport({ canvasRef, paneRef }: CanvasViewportOptions) {
  const zoom = useOverlayStore((s) => s.zoom);
  const setZoom = useOverlayStore((s) => s.setZoom);
  const nudgePan = useOverlayStore((s) => s.nudgePan);

  const pendingFocus = useRef<FocalRequest | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const panOrigin = useRef<{ x: number; y: number } | null>(null);

  /** Scene coordinates under a screen point, read live so pan and scroll are included. */
  const sceneAt = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return null;
      return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
    },
    [canvasRef, zoom]
  );

  // Bound natively rather than through onWheel: React registers wheel handlers
  // passively, so preventDefault() there is ignored and the page zooms away
  // under the cursor. Same options the VOD timeline uses.
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;

    const onWheel = (event: WheelEvent) => {
      // Trackpad pinch arrives as ctrl+wheel, so this covers both.
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();

      const scene = sceneAt(event.clientX, event.clientY);
      const next = wheelZoom(zoom, event.deltaY);
      if (next === zoom) return;

      if (scene) {
        pendingFocus.current = {
          clientX: event.clientX,
          clientY: event.clientY,
          sceneX: scene.x,
          sceneY: scene.y,
        };
      }
      setZoom(next);
    };

    pane.addEventListener("wheel", onWheel, { passive: false });
    return () => pane.removeEventListener("wheel", onWheel);
  }, [paneRef, sceneAt, setZoom, zoom]);

  // The zoom has landed and the canvas has been laid out: nudge the pan so the
  // point that was under the cursor is under it again.
  useLayoutEffect(() => {
    const focus = pendingFocus.current;
    if (!focus) return;
    pendingFocus.current = null;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const { dx, dy } = focalPanCorrection(rect, focus, zoom);
    nudgePan(dx, dy);
  }, [zoom, canvasRef, nudgePan]);

  // Space pans, but not while it is being typed into something.
  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return (
        !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTyping(e.target)) return;
      // Otherwise Space scrolls the pane out from under the drag.
      e.preventDefault();
      setSpaceHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    // Alt-tabbing away never delivers the keyup.
    const onBlur = () => setSpaceHeld(false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  /** True when this mousedown should pan instead of selecting or marquee-ing. */
  const handlePanMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const isMiddle = e.button === 1;
      if (!isMiddle && !(spaceHeld && e.button === 0)) return false;
      e.preventDefault();
      e.stopPropagation();
      panOrigin.current = { x: e.clientX, y: e.clientY };
      setPanning(true);
      return true;
    },
    [spaceHeld]
  );

  const handlePanMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const origin = panOrigin.current;
      if (!origin) return false;
      nudgePan(e.clientX - origin.x, e.clientY - origin.y);
      panOrigin.current = { x: e.clientX, y: e.clientY };
      return true;
    },
    [nudgePan]
  );

  const handlePanMouseUp = useCallback(() => {
    if (!panOrigin.current) return false;
    panOrigin.current = null;
    setPanning(false);
    return true;
  }, []);

  return {
    /** Space is down, so a click would pan: show the open hand. */
    panReady: spaceHeld,
    panning,
    handlePanMouseDown,
    handlePanMouseMove,
    handlePanMouseUp,
  };
}
