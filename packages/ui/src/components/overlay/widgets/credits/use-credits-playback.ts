"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { progressAt, stepIndexAt, type CreditsMeasured, type CreditsTimeline } from "./credits-playback";

/** Redraws per second while a roll plays. Transforms are cheap; React renders aren't. */
const FRAME_MS = 1000 / 30;

export interface CreditsPlayback {
  elapsedMs: number;
  progress: number;
  stepIndex: number;
  /** True once a play-once roll has reached its end and is holding. */
  ended: boolean;
}

/**
 * Runs the clock for a roll. `playKey` restarts from zero whenever it
 * changes; `playing` false freezes wherever it is. A finished roll holds its
 * last frame; with `loop` on it starts over after `holdMs` (0 wraps a scroll
 * in one motion).
 */
export function useCreditsPlayback({
  timeline,
  playing,
  playKey,
  loop,
  holdMs = 0,
}: {
  timeline: CreditsTimeline;
  playing: boolean;
  playKey: number;
  loop: boolean;
  holdMs?: number;
}): CreditsPlayback {
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedRef = useRef(0);
  const totalRef = useRef(timeline.totalMs);
  totalRef.current = timeline.totalMs;

  // A new roll starts from the top.
  useEffect(() => {
    elapsedRef.current = 0;
    setElapsedMs(0);
  }, [playKey]);

  useEffect(() => {
    if (!playing || typeof window === "undefined") return;
    let raf = 0;
    let last = performance.now();
    let lastPaint = last;
    let holdUntil: number | null = null;

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const total = totalRef.current;
      if (holdUntil !== null) {
        if (now >= holdUntil) {
          holdUntil = null;
          elapsedRef.current = 0;
          setElapsedMs(0);
          lastPaint = now;
        }
      } else if (elapsedRef.current < total) {
        elapsedRef.current = Math.min(total, elapsedRef.current + dt);
        if (now - lastPaint >= FRAME_MS || elapsedRef.current >= total) {
          lastPaint = now;
          setElapsedMs(elapsedRef.current);
        }
      } else if (loop) {
        if (holdMs <= 0) {
          // Straight round: carry the overshoot so the speed doesn't hitch.
          elapsedRef.current = Math.max(0, elapsedRef.current + dt - total);
          setElapsedMs(elapsedRef.current);
          lastPaint = now;
        } else {
          holdUntil = now + holdMs;
        }
      } else {
        // Play once: done, hold the last frame and stop ticking.
        setElapsedMs(total);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, playKey, loop, holdMs]);

  const progress = progressAt(timeline, elapsedMs);
  return {
    elapsedMs,
    progress,
    stepIndex: stepIndexAt(timeline, elapsedMs),
    ended: timeline.totalMs > 0 && elapsedMs >= timeline.totalMs,
  };
}

/** `prefers-reduced-motion`, live. False during SSR and in browsers without matchMedia. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * The content's length and the box's length along the scroll axis, kept
 * current through resizes and late web fonts. `horizontal` measures widths.
 */
export function useCreditsMeasured(
  rootRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  horizontal: boolean,
  deps: readonly unknown[],
): CreditsMeasured {
  const [measured, setMeasured] = useState<CreditsMeasured>({ contentPx: 0, viewportPx: 0 });

  useLayoutEffect(() => {
    const root = rootRef.current;
    const content = contentRef.current;
    if (!root || !content) return;
    const measure = () => {
      const next = horizontal
        ? { contentPx: content.scrollWidth, viewportPx: root.clientWidth }
        : { contentPx: content.scrollHeight, viewportPx: root.clientHeight };
      setMeasured((prev) => (prev.contentPx === next.contentPx && prev.viewportPx === next.viewportPx ? prev : next));
    };
    measure();
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {});
    }
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    ro.observe(content);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef, contentRef, horizontal, ...deps]);

  return measured;
}

/** How a browser source in OBS says whether it's on screen (OBS 27.2+). */
interface ObsVisibilityEvent extends Event {
  detail?: { visible?: boolean };
}

declare global {
  interface Window {
    obsstudio?: { onVisibilityChange?: (visible: boolean) => void };
  }
}

/** Show and hide land within this window are one change; OBS fires both across a transition. */
const VISIBILITY_DEBOUNCE_MS = 250;

/**
 * Calls `onShow` when the widget comes on screen and `onHide` when it leaves.
 * Covers the ways OBS reports it: a fresh page load (Shutdown source when not
 * visible), `visibilitychange` on the document, and OBS's own
 * `obsSourceVisibleChanged` event. Outside OBS an IntersectionObserver on the
 * root does the same for a browser tab scrolled off screen. Does nothing
 * while `enabled` is false (the editor canvas).
 */
export function useRollOnVisible(
  enabled: boolean,
  rootRef: RefObject<HTMLElement | null>,
  onShow: () => void,
  onHide: () => void,
) {
  const show = useRef(onShow);
  const hide = useRef(onHide);
  show.current = onShow;
  hide.current = onHide;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let visible: boolean | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const settle = (next: boolean) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (visible === next) return;
        visible = next;
        if (next) show.current();
        else hide.current();
      }, VISIBILITY_DEBOUNCE_MS);
    };

    const docVisible = () => document.visibilityState !== "hidden";
    const onVisibility = () => settle(docVisible());
    document.addEventListener("visibilitychange", onVisibility);

    const onObs = (e: Event) => {
      const detail = (e as ObsVisibilityEvent).detail;
      if (detail && typeof detail.visible === "boolean") settle(detail.visible);
    };
    window.addEventListener("obsSourceVisibleChanged", onObs);
    const previousObs = window.obsstudio?.onVisibilityChange;
    if (window.obsstudio) window.obsstudio.onVisibilityChange = (v: boolean) => settle(v);

    let io: IntersectionObserver | null = null;
    const root = rootRef.current;
    if (root && typeof IntersectionObserver !== "undefined" && !window.obsstudio) {
      io = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry) settle(entry.isIntersecting && docVisible());
        },
        { threshold: 0.01 },
      );
      io.observe(root);
    } else {
      // A fresh load in OBS, or no observer: the page is up, so it's showing.
      settle(docVisible());
    }

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("obsSourceVisibleChanged", onObs);
      if (window.obsstudio) window.obsstudio.onVisibilityChange = previousObs;
      io?.disconnect();
    };
  }, [enabled, rootRef]);
}
