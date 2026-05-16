"use client";

import type { CSSProperties, RefObject } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ClipsWidgetConfig, DisplayFieldKey, ClipDataRow } from "../../types";
import { formatClipField } from "../../lib/format-clip-fields";

export interface ClipsWidgetRendererProps {
  /** Pre-fetched clip playlist. The renderer never fetches — containers provide this. */
  clips: ClipDataRow[];
  loading: boolean;
  /**
   * Called when the renderer wants the container to refresh the clip playlist
   * (e.g. after exhausting the list). Optional; containers with a refresh interval
   * may not need this.
   */
  onRequestRefresh?: () => void;
  /**
   * Resolves a signed video URL for the given clip. Called lazily (prefetch + on demand).
   * Should return null if the URL cannot be obtained.
   */
  resolveClipUrl: (clipId: string, broadcasterId: string) => Promise<string | null>;
  /** Composite config including display field visibility, layout, and playback settings. */
  config: ClipsWidgetConfig;
}

type ResolvedClip = ClipDataRow & {
  videoUrl?: string;
  failed?: boolean;
};

function shuffleIndices(length: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = indices[i] as number;
    indices[i] = indices[j] as number;
    indices[j] = tmp;
  }
  return indices;
}

function createPlaybackOrder(
  length: number,
  random: boolean,
  previousFirst?: number
): number[] {
  if (length <= 1) return [0];
  if (!random) return Array.from({ length }, (_, i) => i);

  const order = shuffleIndices(length);
  if (previousFirst !== undefined && length > 1 && order[0] === previousFirst) {
    const swapIndex = 1 + Math.floor(Math.random() * (length - 1));
    const tmp = order[0] as number;
    order[0] = order[swapIndex] as number;
    order[swapIndex] = tmp;
  }
  return order;
}

function resolveHref(url: string): string {
  try {
    return new URL(url, typeof window !== "undefined" ? window.location.href : "http://localhost").href;
  } catch {
    return url;
  }
}

const DEFAULT_FIELD_LAYOUT = { x: 0, y: 88, w: 100, h: 12, fontSize: 16 };

export function ClipsWidgetRenderer({
  clips: clipsProp,
  loading,
  config,
  resolveClipUrl: resolveClipUrlProp,
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

  const [clips, setClips] = useState<ResolvedClip[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playOrder, setPlayOrder] = useState<number[]>([]);
  const [orderPosition, setOrderPosition] = useState(0);
  const [activePlayer, setActivePlayer] = useState<0 | 1>(0);

  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);
  const urlCacheRef = useRef<Record<string, string>>({});
  const urlFetchInFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const nextClips: ResolvedClip[] = clipsProp.map((c) => ({ ...c }));
    const nextOrder = createPlaybackOrder(nextClips.length, isRandomMode);
    setClips(nextClips);
    setPlayOrder(nextOrder);
    setOrderPosition(0);
    setCurrentIndex(nextOrder[0] ?? 0);
    setActivePlayer(0);
    urlCacheRef.current = {};
    urlFetchInFlightRef.current.clear();
  }, [clipsProp, isRandomMode]);

  useEffect(() => {
    const a = videoRefA.current;
    const b = videoRefB.current;
    if (!a || !b) return;

    const pauseHidden = () => {
      if (activePlayer === 0) b.pause();
      else a.pause();
    };

    if (clipCrossfadeMs <= 0) {
      pauseHidden();
      return;
    }

    const id = window.setTimeout(pauseHidden, clipCrossfadeMs);
    return () => window.clearTimeout(id);
  }, [activePlayer, clipCrossfadeMs]);

  const getActiveRef = useCallback(
    () => (activePlayer === 0 ? videoRefA : videoRefB),
    [activePlayer]
  );
  const getInactiveRef = useCallback(
    () => (activePlayer === 0 ? videoRefB : videoRefA),
    [activePlayer]
  );

  const resolveClipUrl = useCallback(
    async (clip: ResolvedClip): Promise<string | null> => {
      if (clip.videoUrl) return clip.videoUrl;
      if (clip.failed) return null;
      const cachedUrl = urlCacheRef.current[clip.clipId];
      if (cachedUrl) return cachedUrl;

      try {
        const url = await resolveClipUrlProp(clip.clipId, clip.broadcasterId);
        if (!url) return null;
        urlCacheRef.current[clip.clipId] = url;
        return url;
      } catch {
        return null;
      }
    },
    [resolveClipUrlProp]
  );

  const loadClipIntoPlayer = useCallback(
    async (index: number, videoRef: RefObject<HTMLVideoElement | null>): Promise<boolean> => {
      if (index < 0 || index >= clips.length || !videoRef.current) return false;

      const clip = clips[index] as ResolvedClip;
      const url = await resolveClipUrl(clip);

      if (!url) {
        setClips((prev) =>
          prev.map((c, i) => (i === index ? { ...c, failed: true } : c))
        );
        return false;
      }

      setClips((prev) =>
        prev.map((c, i) => (i === index ? { ...c, videoUrl: url } : c))
      );

      const el = videoRef.current;
      const targetHref = resolveHref(url);
      if (el.currentSrc && (el.currentSrc === targetHref || el.src === targetHref)) {
        return true;
      }

      el.src = url;
      el.load();
      return true;
    },
    [clips, resolveClipUrl]
  );

  const prefetchClipUrl = useCallback(
    async (index: number) => {
      if (index < 0 || index >= clips.length) return;
      const clip = clips[index];
      if (!clip || clip.failed || clip.videoUrl) return;

      if (urlCacheRef.current[clip.clipId]) {
        const cached = urlCacheRef.current[clip.clipId];
        setClips((prev) =>
          prev.map((c, i) => (i === index ? { ...c, videoUrl: cached } : c))
        );
        return;
      }

      if (urlFetchInFlightRef.current.has(clip.clipId)) return;
      urlFetchInFlightRef.current.add(clip.clipId);

      try {
        const url = await resolveClipUrl(clip);
        if (!url) return;
        setClips((prev) =>
          prev.map((c, i) => (i === index ? { ...c, videoUrl: url } : c))
        );
      } finally {
        urlFetchInFlightRef.current.delete(clip.clipId);
      }
    },
    [clips, resolveClipUrl]
  );

  useEffect(() => {
    if (clips.length === 0 || loading) return;
    void loadClipIntoPlayer(currentIndex, getActiveRef());
  }, [clips.length, loading, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (clips.length <= 1 || loading) return;
    let nextIndex = (currentIndex + 1) % clips.length;
    if (isRandomMode && playOrder.length === clips.length) {
      if (orderPosition + 1 < playOrder.length) {
        nextIndex = playOrder[orderPosition + 1] as number;
      } else {
        const nextOrder = createPlaybackOrder(clips.length, true, currentIndex);
        nextIndex = nextOrder[0] as number;
      }
    }
    void prefetchClipUrl(nextIndex);
  }, [clips, currentIndex, loading, prefetchClipUrl, isRandomMode, playOrder, orderPosition]);

  const playNext = useCallback(async () => {
    if (clips.length <= 1) {
      const ref = getActiveRef();
      if (ref.current) {
        ref.current.currentTime = 0;
        ref.current.play().catch(() => {});
      }
      return;
    }

    let nextIdx = (currentIndex + 1) % clips.length;
    let tempOrder =
      playOrder.length === clips.length
        ? [...playOrder]
        : createPlaybackOrder(clips.length, isRandomMode);
    let tempOrderPosition = orderPosition;
    let attempts = 0;

    while (attempts < clips.length) {
      if (isRandomMode) {
        tempOrderPosition += 1;
        if (tempOrderPosition >= tempOrder.length) {
          tempOrder = createPlaybackOrder(clips.length, true, currentIndex);
          tempOrderPosition = 0;
        }
        nextIdx = tempOrder[tempOrderPosition] as number;
      } else if (attempts > 0) {
        nextIdx = (nextIdx + 1) % clips.length;
      }

      const inactiveRef = getInactiveRef();
      const loaded = await loadClipIntoPlayer(nextIdx, inactiveRef);
      const inactiveEl = inactiveRef.current;

      if (loaded && inactiveEl) {
        await new Promise<void>((resolve) => {
          const handler = () => {
            inactiveEl.removeEventListener("canplay", handler);
            resolve();
          };
          inactiveEl.addEventListener("canplay", handler);
          window.setTimeout(resolve, 3000);
        });

        setActivePlayer((prev) => (prev === 0 ? 1 : 0));
        setCurrentIndex(nextIdx);
        if (isRandomMode) {
          setPlayOrder(tempOrder);
          setOrderPosition(tempOrderPosition);
        } else {
          setOrderPosition(nextIdx);
        }

        inactiveEl.play().catch(() => {});
        return;
      }

      attempts++;
    }
  }, [
    clips,
    currentIndex,
    isRandomMode,
    playOrder,
    orderPosition,
    getActiveRef,
    getInactiveRef,
    loadClipIntoPlayer,
  ]);

  useEffect(() => {
    const a = videoRefA.current;
    const b = videoRefB.current;
    if (!a || !b) return;
    const active = activePlayer === 0 ? a : b;
    active.play().catch(() => {});
  }, [activePlayer]);

  useEffect(() => {
    const a = videoRefA.current;
    const b = videoRefB.current;
    if (a) { a.muted = config.clipMuted; a.volume = config.clipVolume; }
    if (b) { b.muted = config.clipMuted; b.volume = config.clipVolume; }
  }, [config.clipMuted, config.clipVolume]);

  const currentClip = clips[currentIndex];

  if (loading) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.85)",
          color: "#888",
          fontFamily: "system-ui, sans-serif",
          fontSize: 14,
        }}
      >
        Loading clips…
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.85)",
          color: "#888",
          fontFamily: "system-ui, sans-serif",
          fontSize: 14,
        }}
      >
        No clips match this widget.
      </div>
    );
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
      <video
        ref={videoRefA}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          opacity: activePlayer === 0 ? 1 : 0,
          zIndex: activePlayer === 0 ? 1 : 0,
          ...videoOpacityTransitionStyle,
        }}
        muted={config.clipMuted}
        playsInline
        onEnded={playNext}
        onCanPlay={() => {
          if (activePlayer === 0) videoRefA.current?.play().catch(() => {});
        }}
        onError={() => {
          if (activePlayer === 0) void playNext();
        }}
      />
      <video
        ref={videoRefB}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          opacity: activePlayer === 1 ? 1 : 0,
          zIndex: activePlayer === 1 ? 1 : 0,
          ...videoOpacityTransitionStyle,
        }}
        muted={config.clipMuted}
        playsInline
        onEnded={playNext}
        onCanPlay={() => {
          if (activePlayer === 1) videoRefB.current?.play().catch(() => {});
        }}
        onError={() => {
          if (activePlayer === 1) void playNext();
        }}
      />

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
