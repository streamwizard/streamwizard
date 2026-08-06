"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClipsWidgetConfig, DisplayFieldKey, ClipDataRow } from "../../types";
import { formatClipField } from "../../lib/format-clip-fields";

/** Opaque to the renderer — handed back to `fetchNextClip` to continue the rotation. */
export type ClipRotationCursor = unknown;

export interface NextClipResult {
  clip: ClipDataRow;
  videoUrl: string;
  cursor: ClipRotationCursor;
}

export interface ClipsWidgetRendererProps {
  /**
   * Fetches the next clip to play, already carrying a playable URL. Called once
   * per transition; the renderer keeps one clip buffered ahead so this never
   * blocks what is on screen. Returns null when nothing matches the filters.
   */
  fetchNextClip: (
    cursor: ClipRotationCursor,
    excludeClipIds: string[]
  ) => Promise<NextClipResult | null>;
  /** Composite config including display field visibility, layout, and playback settings. */
  config: ClipsWidgetConfig;
}

/** How long a clip stays ineligible for a random re-draw. */
const RECENTLY_PLAYED_MS = 10 * 60 * 1000;

/** Give up waiting for `canplay` and swap anyway rather than freezing the rotation. */
const BUFFER_TIMEOUT_MS = 8000;

const SLOT_COUNT = 3;

const DEFAULT_FIELD_LAYOUT = { x: 0, y: 88, w: 100, h: 12, fontSize: 16 };

type Slot = {
  clip: ClipDataRow;
  videoUrl: string;
};

const EMPTY_STATE_STYLE: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.85)",
  color: "#888",
  fontFamily: "system-ui, sans-serif",
  fontSize: 14,
};

/**
 * Three `<video>` elements in a ring: one visible, one fully buffered behind it,
 * one being fetched. A clip transition promotes the buffered element and starts
 * the next fetch, so the widget never shows a loading state mid-rotation.
 */
export function ClipsWidgetRenderer({
  fetchNextClip,
  config,
}: ClipsWidgetRendererProps) {
  const isRandomMode = config.sort === "random";

  const clipCrossfadeMs = useMemo(() => {
    if (config.clipTransition !== "crossfade") return 0;
    return Math.min(3000, Math.max(200, config.clipTransitionMs));
  }, [config.clipTransition, config.clipTransitionMs]);

  const videoOpacityTransitionStyle = useMemo(
    () =>
      ({
        transitionProperty: "opacity",
        transitionDuration: clipCrossfadeMs > 0 ? `${clipCrossfadeMs}ms` : "0ms",
        transitionTimingFunction: "ease-in-out",
      }) satisfies CSSProperties,
    [clipCrossfadeMs]
  );

  const [slots, setSlots] = useState<(Slot | null)[]>(() =>
    Array.from({ length: SLOT_COUNT }, () => null)
  );
  const [activeSlot, setActiveSlot] = useState(0);
  const [status, setStatus] = useState<"initial" | "playing" | "empty">("initial");

  const videoRefs = useRef<(HTMLVideoElement | null)[]>(
    Array.from({ length: SLOT_COUNT }, () => null)
  );
  const cursorRef = useRef<ClipRotationCursor>(null);
  const recentlyPlayedRef = useRef<Map<string, number>>(new Map());
  const transitioningRef = useRef(false);
  const mountedRef = useRef(true);
  /** Serialises fetches — two transitions must not race for the same cursor. */
  const fillQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  /** Mirrors `slots` for reads inside async work, where state would be stale. */
  const slotsRef = useRef<(Slot | null)[]>(slots);

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const recentlyPlayedIds = useCallback((): string[] => {
    if (!isRandomMode) return [];
    const now = Date.now();
    const ids: string[] = [];
    for (const [clipId, playedAt] of recentlyPlayedRef.current) {
      if (now - playedAt > RECENTLY_PLAYED_MS) {
        recentlyPlayedRef.current.delete(clipId);
      } else {
        ids.push(clipId);
      }
    }
    return ids;
  }, [isRandomMode]);

  /** Resolves once the element can play through, or once we stop waiting on it. */
  const waitForBuffer = useCallback((el: HTMLVideoElement): Promise<void> => {
    if (el.readyState >= 3) return Promise.resolve();

    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        el.removeEventListener("canplay", finish);
        el.removeEventListener("error", finish);
        window.clearTimeout(timeoutId);
        resolve();
      };
      const timeoutId = window.setTimeout(finish, BUFFER_TIMEOUT_MS);
      el.addEventListener("canplay", finish);
      el.addEventListener("error", finish);
    });
  }, []);

  /**
   * Loads the next clip into `slotIndex` and buffers it. Queued rather than
   * dropped when another fill is in flight: a clip ending mid-prefetch must wait
   * its turn, not bail and leave the rotation stuck.
   */
  const fillSlot = useCallback(
    (slotIndex: number): Promise<boolean> => {
      const run = async (): Promise<boolean> => {
        try {
          const next = await fetchNextClip(cursorRef.current, recentlyPlayedIds());
          if (!mountedRef.current) return false;
          if (!next) return false;

          cursorRef.current = next.cursor;
          const slot = { clip: next.clip, videoUrl: next.videoUrl };
          slotsRef.current = slotsRef.current.map((existing, i) =>
            i === slotIndex ? slot : existing
          );
          setSlots(slotsRef.current);

          const el = videoRefs.current[slotIndex];
          if (el) {
            el.src = next.videoUrl;
            el.load();
            await waitForBuffer(el);
          }
          return true;
        } catch {
          return false;
        }
      };

      const chained = fillQueueRef.current.then(run, run);
      fillQueueRef.current = chained.catch(() => undefined);
      return chained;
    },
    [fetchNextClip, recentlyPlayedIds, waitForBuffer]
  );

  // First clip: fill the visible slot, then buffer the one behind it.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const ok = await fillSlot(0);
      if (cancelled || !mountedRef.current) return;

      if (!ok) {
        setStatus("empty");
        return;
      }

      setStatus("playing");
      videoRefs.current[0]?.play().catch(() => {});
      await fillSlot(1);
    })();

    return () => {
      cancelled = true;
    };
    // Rotation restarts only when the widget's clip source changes.
  }, [fetchNextClip]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = useCallback(async () => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;

    try {
      const current = activeSlot;
      const nextSlot = (current + 1) % SLOT_COUNT;
      const followingSlot = (current + 2) % SLOT_COUNT;

      // The buffered slot may be missing if the previous fetch failed — fetch it
      // now. Costs a visible pause, but only in the already-degraded case.
      if (!slotsRef.current[nextSlot]) {
        const filled = await fillSlot(nextSlot);
        if (!filled || !mountedRef.current) return;
      }

      const nextEl = videoRefs.current[nextSlot];
      if (nextEl) {
        await waitForBuffer(nextEl);
        if (!mountedRef.current) return;
        nextEl.currentTime = 0;
        nextEl.play().catch(() => {});
      }

      const outgoing = slotsRef.current[current];
      if (outgoing) {
        recentlyPlayedRef.current.set(outgoing.clip.clipId, Date.now());
      }

      setActiveSlot(nextSlot);

      // Let the crossfade finish before stopping the clip that just left.
      const outgoingEl = videoRefs.current[current];
      if (outgoingEl) {
        window.setTimeout(() => {
          outgoingEl.pause();
        }, clipCrossfadeMs);
      }

      // Refill the slot we just vacated so one clip is always buffered ahead.
      void fillSlot(followingSlot);
    } finally {
      transitioningRef.current = false;
    }
  }, [activeSlot, fillSlot, waitForBuffer, clipCrossfadeMs]);

  useEffect(() => {
    for (const el of videoRefs.current) {
      if (!el) continue;
      el.muted = config.clipMuted;
      el.volume = config.clipVolume;
    }
  }, [config.clipMuted, config.clipVolume]);

  const currentClip = slots[activeSlot]?.clip;

  if (status === "initial") {
    return <div style={EMPTY_STATE_STYLE}>Loading clips…</div>;
  }

  if (status === "empty") {
    return <div style={EMPTY_STATE_STYLE}>No clips match this widget.</div>;
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#000",
      }}
    >
      {Array.from({ length: SLOT_COUNT }, (_, slotIndex) => (
        <video
          key={slotIndex}
          ref={(el) => {
            videoRefs.current[slotIndex] = el;
          }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: activeSlot === slotIndex ? 1 : 0,
            zIndex: activeSlot === slotIndex ? 1 : 0,
            ...videoOpacityTransitionStyle,
          }}
          muted={config.clipMuted}
          playsInline
          onEnded={() => {
            if (activeSlot === slotIndex) void advance();
          }}
          onError={() => {
            if (activeSlot === slotIndex) void advance();
          }}
        />
      ))}

      {currentClip ? (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {config.displayFieldOrder.map((key: DisplayFieldKey) => {
            if (!config.displayFields[key]) return null;
            const layout = config.displayFieldLayouts[key] ?? DEFAULT_FIELD_LAYOUT;
            return (
              <div
                key={key}
                style={{
                  position: "absolute",
                  left: `${layout.x}%`,
                  top: `${layout.y}%`,
                  width: `${layout.w}%`,
                  height: `${layout.h}%`,
                  fontSize: layout.fontSize,
                  color: "#fff",
                  fontFamily: "system-ui, sans-serif",
                  fontWeight: 600,
                  textShadow: "0 1px 4px rgba(0,0,0,0.85)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  overflow: "hidden",
                  boxSizing: "border-box",
                  padding: "2px 6px",
                }}
              >
                <span
                  style={{
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    width: "100%",
                  }}
                >
                  {formatClipField(
                    {
                      title: currentClip.title,
                      creatorName: currentClip.creatorName,
                      gameName: currentClip.gameName,
                      createdAtTwitch: currentClip.createdAtTwitch,
                      viewCount: currentClip.viewCount,
                      durationSec: currentClip.durationSec,
                    },
                    key
                  )}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
