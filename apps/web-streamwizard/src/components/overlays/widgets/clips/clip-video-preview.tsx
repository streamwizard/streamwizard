"use client";

import { Loader2, Pause, Play, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { PreviewClip } from "@/actions/overlays-preview";
import { getPreviewClips } from "@/actions/overlays-preview";
import {
  DEFAULT_CLIPS_WIDGET_CONFIG,
  type ClipDisplayFieldLayout,
  type ClipsWidgetConfig,
  type DisplayFieldKey,
  resolvedDisplayFieldLocks,
  resolvedDisplayFieldOrder,
} from "@/types/overlays";
import { CLIP_NESTED_DISPLAY_FIELDS } from "./nested-fields";
import type { EditorClipPlaybackControls } from "../../registry/overlay-widget-registry.types";

interface ClipVideoPreviewProps {
  config: ClipsWidgetConfig;
  zoom: number;
  editable?: boolean;
  /** When set with `onSelectField`, selection is controlled by the parent (e.g. overlay editor store). */
  selectedFieldKey?: DisplayFieldKey | null;
  /** Editor-only: pause / force-mute / autoplay state lives in the overlay store (not persisted). */
  editorClipPlayback?: EditorClipPlaybackControls;
  onSelectField?: (field: DisplayFieldKey | null) => void;
  onUpdateDisplayFieldLayout?: (
    field: DisplayFieldKey,
    layout: Partial<ClipDisplayFieldLayout>
  ) => void;
}

interface ResolvedClip extends PreviewClip {
  videoUrl?: string;
  resolving?: boolean;
  failed?: boolean;
}

function shuffleIndices(length: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

function createPlaybackOrder(length: number, random: boolean, previousFirst?: number): number[] {
  if (length <= 1) return [0];
  if (!random) return Array.from({ length }, (_, i) => i);

  let order = shuffleIndices(length);
  if (previousFirst !== undefined && length > 1 && order[0] === previousFirst) {
    const swapIndex = 1 + Math.floor(Math.random() * (length - 1));
    [order[0], order[swapIndex]] = [order[swapIndex], order[0]];
  }
  return order;
}

export function ClipVideoPreview({
  config,
  zoom,
  editable = false,
  selectedFieldKey: selectedFieldKeyProp,
  editorClipPlayback,
  onSelectField,
  onUpdateDisplayFieldLayout,
}: ClipVideoPreviewProps) {
  const [clips, setClips] = useState<ResolvedClip[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playOrder, setPlayOrder] = useState<number[]>([]);
  const [orderPosition, setOrderPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [sessionMuted, setSessionMuted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePlayer, setActivePlayer] = useState<0 | 1>(0);
  const isRandomMode = config.sort === "random";

  const previewEditor = editorClipPlayback != null;

  const persistedMuted =
    config.clipMuted ?? DEFAULT_CLIPS_WIDGET_CONFIG.clipMuted;
  const volume = config.clipVolume ?? 1;
  const muted = previewEditor
    ? editorClipPlayback.previewForceMute || persistedMuted
    : (sessionMuted ?? persistedMuted);

  const mediaShouldPlay = previewEditor
    ? !editorClipPlayback.previewPaused && isPlaying
    : isPlaying;

  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const urlCacheRef = useRef<Record<string, string>>({});
  const urlFetchInFlightRef = useRef<Set<string>>(new Set());
  const [internalSelectedField, setInternalSelectedField] =
    useState<DisplayFieldKey | null>(null);
  const selectionControlled = editable && onSelectField !== undefined;
  const selectedField = selectionControlled
    ? (selectedFieldKeyProp ?? null)
    : internalSelectedField;
  const setSelectedField = useCallback(
    (field: DisplayFieldKey | null) => {
      if (selectionControlled) onSelectField?.(field);
      else setInternalSelectedField(field);
    },
    [selectionControlled, onSelectField]
  );
  const [fieldDrag, setFieldDrag] = useState<{
    field: DisplayFieldKey;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    startLayout: ClipDisplayFieldLayout;
    width: number;
    height: number;
  } | null>(null);

  // Only settings that affect clip selection/order should trigger a full reload.
  // Layout/display edits should not restart playback during drag.
  const clipQueryKey = useMemo(
    () =>
      JSON.stringify({
        sourceMode: config.sourceMode,
        folderIds: config.folderIds,
        gameIds: config.gameIds,
        creatorIds: config.creatorIds,
        timeWindow: config.timeWindow,
        customDateRange: config.customDateRange,
        sort: config.sort,
        maxClips: config.maxClips,
        minViewCount: config.minViewCount,
        isFeaturedOnly: config.isFeaturedOnly,
      }),
    [
      config.sourceMode,
      config.folderIds,
      config.gameIds,
      config.creatorIds,
      config.timeWindow,
      config.customDateRange,
      config.sort,
      config.maxClips,
      config.minViewCount,
      config.isFeaturedOnly,
    ]
  );

  const displayFieldOrder = useMemo(
    () => resolvedDisplayFieldOrder(config),
    [config.displayFieldOrder]
  );

  const displayFieldLocksMap = useMemo(
    () => resolvedDisplayFieldLocks(config),
    [config.displayFieldLocks]
  );

  const clipCrossfadeMs = useMemo(() => {
    const mode =
      config.clipTransition ?? DEFAULT_CLIPS_WIDGET_CONFIG.clipTransition;
    if (mode !== "crossfade") return 0;
    const raw =
      config.clipTransitionMs ?? DEFAULT_CLIPS_WIDGET_CONFIG.clipTransitionMs;
    return Math.min(3000, Math.max(200, raw));
  }, [config.clipTransition, config.clipTransitionMs]);

  const videoOpacityTransitionStyle = useMemo(
    () =>
      ({
        transitionProperty: "opacity",
        transitionDuration:
          clipCrossfadeMs > 0 ? `${clipCrossfadeMs}ms` : "0ms",
        transitionTimingFunction: "ease-in-out",
      }) satisfies CSSProperties,
    [clipCrossfadeMs]
  );

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

  const prevEditorPreviewPausedRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!editorClipPlayback) {
      prevEditorPreviewPausedRef.current = null;
      return;
    }

    const paused = editorClipPlayback.previewPaused;
    const prev = prevEditorPreviewPausedRef.current;
    prevEditorPreviewPausedRef.current = paused;

    if (paused) {
      setIsPlaying(false);
    } else if (prev === true && paused === false) {
      // Header or "Allow playback" lifted editor pause — resume local play intent.
      setIsPlaying(true);
    }
  }, [editorClipPlayback?.previewPaused]);

  useEffect(() => {
    const a = videoRefA.current;
    const b = videoRefB.current;
    if (!a || !b) return;

    if (mediaShouldPlay) {
      const active = activePlayer === 0 ? a : b;
      active.play().catch((err) => {
        if (
          previewEditor &&
          err instanceof DOMException &&
          err.name === "NotAllowedError"
        ) {
          editorClipPlayback?.setAutoplayBlocked(true);
        }
      });
    } else {
      a.pause();
      b.pause();
    }
  }, [
    mediaShouldPlay,
    activePlayer,
    previewEditor,
    editorClipPlayback,
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    urlCacheRef.current = {};
    urlFetchInFlightRef.current.clear();

    getPreviewClips(config).then((result) => {
      if (cancelled) return;
      const nextClips = result.clips.map((c) => ({ ...c }));
      const nextOrder = createPlaybackOrder(nextClips.length, config.sort === "random");

      setClips(nextClips);
      setPlayOrder(nextOrder);
      setOrderPosition(0);
      setCurrentIndex(nextOrder[0] ?? 0);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [clipQueryKey]);

  const resolveClipUrl = useCallback(
    async (clip: ResolvedClip): Promise<string | null> => {
      if (clip.videoUrl) return clip.videoUrl;
      if (clip.failed) return null;
      const cachedUrl = urlCacheRef.current[clip.twitch_clip_id];
      if (cachedUrl) return cachedUrl;

      try {
        const res = await fetch("/api/overlays/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clipId: clip.twitch_clip_id,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error("Failed to fetch clip URL:", res.status, res.statusText, errorText);
          return null;
        }

        const data = await res.json();
        const signedUrl = data.landscape_url;
        if (!signedUrl) return null;

        const proxiedUrl = `/api/overlays/preview/stream?url=${encodeURIComponent(signedUrl)}`;
        urlCacheRef.current[clip.twitch_clip_id] = proxiedUrl;
        return proxiedUrl;
      } catch {
        return null;
      }
    },
    []
  );

  const loadClipIntoPlayer = useCallback(
    async (index: number, videoRef: React.RefObject<HTMLVideoElement | null>) => {
      if (index < 0 || index >= clips.length || !videoRef.current) return false;

      const clip = clips[index];
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

      videoRef.current.src = url;
      videoRef.current.load();
      return true;
    },
    [clips, resolveClipUrl]
  );

  const prefetchClipUrl = useCallback(
    async (index: number) => {
      if (index < 0 || index >= clips.length) return;
      const clip = clips[index];
      if (!clip || clip.failed || clip.videoUrl) return;

      if (urlCacheRef.current[clip.twitch_clip_id]) {
        setClips((prev) =>
          prev.map((c, i) =>
            i === index ? { ...c, videoUrl: urlCacheRef.current[clip.twitch_clip_id] } : c
          )
        );
        return;
      }

      if (urlFetchInFlightRef.current.has(clip.twitch_clip_id)) return;
      urlFetchInFlightRef.current.add(clip.twitch_clip_id);

      try {
        const url = await resolveClipUrl(clip);
        if (!url) return;

        setClips((prev) =>
          prev.map((c, i) => (i === index ? { ...c, videoUrl: url } : c))
        );
      } finally {
        urlFetchInFlightRef.current.delete(clip.twitch_clip_id);
      }
    },
    [clips, resolveClipUrl]
  );

  useEffect(() => {
    if (clips.length === 0 || loading) return;
    loadClipIntoPlayer(currentIndex, getActiveRef());
  }, [clips.length, loading, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (clips.length <= 1 || loading) return;
    let nextIndex = (currentIndex + 1) % clips.length;
    if (isRandomMode && playOrder.length === clips.length) {
      if (orderPosition + 1 < playOrder.length) {
        nextIndex = playOrder[orderPosition + 1];
      } else {
        const nextOrder = createPlaybackOrder(clips.length, true, currentIndex);
        nextIndex = nextOrder[0];
      }
    }
    prefetchClipUrl(nextIndex);
  }, [clips, currentIndex, loading, prefetchClipUrl, isRandomMode, playOrder, orderPosition]);

  const playNext = useCallback(async () => {
    if (clips.length <= 1) {
      const ref = getActiveRef();
      if (ref.current) {
        ref.current.currentTime = 0;
        if (mediaShouldPlay) {
          ref.current.play().catch((err) => {
            if (
              previewEditor &&
              err instanceof DOMException &&
              err.name === "NotAllowedError"
            ) {
              editorClipPlayback?.setAutoplayBlocked(true);
            }
          });
        }
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
        nextIdx = tempOrder[tempOrderPosition];
      } else if (attempts > 0) {
        nextIdx = (nextIdx + 1) % clips.length;
      }

      const inactiveRef = getInactiveRef();
      const loaded = await loadClipIntoPlayer(nextIdx, inactiveRef);

      if (loaded && inactiveRef.current) {
        await new Promise<void>((resolve) => {
          const handler = () => {
            inactiveRef.current?.removeEventListener("canplay", handler);
            resolve();
          };
          inactiveRef.current!.addEventListener("canplay", handler);
          setTimeout(resolve, 3000);
        });

        setActivePlayer((prev) => (prev === 0 ? 1 : 0));
        setCurrentIndex(nextIdx);
        if (isRandomMode) {
          setPlayOrder(tempOrder);
          setOrderPosition(tempOrderPosition);
        } else {
          setOrderPosition(nextIdx);
        }

        if (mediaShouldPlay) {
          inactiveRef.current.play().catch((err) => {
            if (
              previewEditor &&
              err instanceof DOMException &&
              err.name === "NotAllowedError"
            ) {
              editorClipPlayback?.setAutoplayBlocked(true);
            }
          });
        }
        return;
      }

      attempts++;
    }
  }, [
    clips,
    currentIndex,
    mediaShouldPlay,
    isRandomMode,
    playOrder,
    orderPosition,
    getActiveRef,
    getInactiveRef,
    loadClipIntoPlayer,
    previewEditor,
    editorClipPlayback,
  ]);

  const togglePlay = useCallback(() => {
    const ref = getActiveRef();
    if (!ref.current) return;

    if (isPlaying) {
      ref.current.pause();
      setIsPlaying(false);
    } else {
      if (previewEditor) {
        editorClipPlayback.setPreviewPaused(false);
      }
      setIsPlaying(true);
      ref.current.play().catch((err) => {
        if (
          previewEditor &&
          err instanceof DOMException &&
          err.name === "NotAllowedError"
        ) {
          editorClipPlayback.setAutoplayBlocked(true);
        }
      });
    }
  }, [isPlaying, getActiveRef, previewEditor, editorClipPlayback]);

  const toggleMute = useCallback(() => {
    if (previewEditor) {
      const currentlyMuted = editorClipPlayback.previewForceMute || persistedMuted;
      if (currentlyMuted) {
        editorClipPlayback.setPreviewForceMute(false);
      } else {
        editorClipPlayback.setPreviewForceMute(true);
      }
    } else {
      setSessionMuted(!muted);
    }
  }, [previewEditor, editorClipPlayback, persistedMuted, muted]);

  useEffect(() => {
    const a = videoRefA.current;
    const b = videoRefB.current;
    if (a) {
      a.muted = muted;
      a.volume = volume;
    }
    if (b) {
      b.muted = muted;
      b.volume = volume;
    }
  }, [muted, volume]);

  const currentClip = clips[currentIndex];

  function getFieldLayout(field: DisplayFieldKey): ClipDisplayFieldLayout {
    return (
      config.displayFieldLayouts?.[field] ??
      DEFAULT_CLIPS_WIDGET_CONFIG.displayFieldLayouts[field]
    );
  }

  useEffect(() => {
    if (!fieldDrag || !onUpdateDisplayFieldLayout) return;
    const activeDrag = fieldDrag;
    const updateLayout = onUpdateDisplayFieldLayout;

    function onMouseMove(e: MouseEvent) {
      const dx = e.clientX - activeDrag.startX;
      const dy = e.clientY - activeDrag.startY;
      const dxPct = (dx / activeDrag.width) * 100;
      const dyPct = (dy / activeDrag.height) * 100;

      if (activeDrag.mode === "move") {
        const nextX = Math.max(
          0,
          Math.min(
            100 - activeDrag.startLayout.w,
            activeDrag.startLayout.x + dxPct
          )
        );
        const nextY = Math.max(
          0,
          Math.min(
            100 - activeDrag.startLayout.h,
            activeDrag.startLayout.y + dyPct
          )
        );
        updateLayout(activeDrag.field, {
          x: Number(nextX.toFixed(2)),
          y: Number(nextY.toFixed(2)),
        });
      } else {
        const nextW = Math.max(
          5,
          Math.min(100 - activeDrag.startLayout.x, activeDrag.startLayout.w + dxPct)
        );
        const nextH = Math.max(
          5,
          Math.min(100 - activeDrag.startLayout.y, activeDrag.startLayout.h + dyPct)
        );
        updateLayout(activeDrag.field, {
          w: Number(nextW.toFixed(2)),
          h: Number(nextH.toFixed(2)),
        });
      }
    }

    function onMouseUp() {
      setFieldDrag(null);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [fieldDrag, onUpdateDisplayFieldLayout]);

  const startFieldDrag = useCallback(
    (
      e: React.MouseEvent,
      field: DisplayFieldKey,
      mode: "move" | "resize"
    ) => {
      if (!editable) return;
      if (displayFieldLocksMap[field]) return;
      e.stopPropagation();
      e.preventDefault();
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();

      setSelectedField(field);
      setFieldDrag({
        field,
        mode,
        startX: e.clientX,
        startY: e.clientY,
        startLayout: getFieldLayout(field),
        width: rect.width,
        height: rect.height,
      });
    },
    [editable, config.displayFieldLayouts, displayFieldLocksMap, setSelectedField]
  );

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/80">
        <Loader2 className="h-6 w-6 text-white/60 animate-spin" />
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/80">
        <span className="text-white/50 text-center px-2" style={{ fontSize: Math.max(10, 12 * zoom) }}>
          No clips match filters
        </span>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="group w-full h-full relative bg-black overflow-hidden"
      onClick={() => {
        if (editable) setSelectedField(null);
      }}
    >
      {/* Dual video players */}
      <video
        ref={videoRefA}
        className="absolute inset-0 w-full h-full object-contain"
        style={{
          opacity: activePlayer === 0 ? 1 : 0,
          zIndex: activePlayer === 0 ? 1 : 0,
          ...videoOpacityTransitionStyle,
        }}
        muted={muted}
        playsInline
        onEnded={playNext}
        onCanPlay={() => {
          if (activePlayer === 0 && mediaShouldPlay) {
            videoRefA.current?.play().catch((err) => {
              if (
                previewEditor &&
                err instanceof DOMException &&
                err.name === "NotAllowedError"
              ) {
                editorClipPlayback?.setAutoplayBlocked(true);
              }
            });
          }
        }}
        onError={() => {
          if (activePlayer === 0) playNext();
        }}
      />
      <video
        ref={videoRefB}
        className="absolute inset-0 w-full h-full object-contain"
        style={{
          opacity: activePlayer === 1 ? 1 : 0,
          zIndex: activePlayer === 1 ? 1 : 0,
          ...videoOpacityTransitionStyle,
        }}
        muted={muted}
        playsInline
        onEnded={playNext}
        onCanPlay={() => {
          if (activePlayer === 1 && mediaShouldPlay) {
            videoRefB.current?.play().catch((err) => {
              if (
                previewEditor &&
                err instanceof DOMException &&
                err.name === "NotAllowedError"
              ) {
                editorClipPlayback?.setAutoplayBlocked(true);
              }
            });
          }
        }}
        onError={() => {
          if (activePlayer === 1) playNext();
        }}
      />

      {/* Clip field sublayers (independent, draggable, resizable) */}
      {currentClip && (
        <>
          {(Object.entries(config.displayFields) as [DisplayFieldKey, boolean][])
            .filter(([_, enabled]) => enabled)
            .sort(
              (a, b) =>
                displayFieldOrder.indexOf(a[0]) -
                displayFieldOrder.indexOf(b[0])
            )
            .map(([field]) => {
              const layout = getFieldLayout(field);
              const isSelectedField = selectedField === field;
              const fieldDef = CLIP_NESTED_DISPLAY_FIELDS[field];
              const value = fieldDef.formatPreviewText(currentClip);
              const locked = displayFieldLocksMap[field];
              const stackZ = 2 + displayFieldOrder.indexOf(field);
              if (!value) return null;

              return (
                <div
                  key={field}
                  className={`absolute text-white/90 px-1 rounded ${
                    editable && isSelectedField
                      ? "ring-1 ring-primary bg-black/35"
                      : "bg-black/25"
                  }`}
                  style={{
                    left: `${layout.x}%`,
                    top: `${layout.y}%`,
                    width: `${layout.w}%`,
                    height: `${layout.h}%`,
                    zIndex: stackZ,
                    fontSize: `${layout.fontSize}px`,
                    lineHeight: 1.2,
                    overflow: "hidden",
                    cursor:
                      editable && !locked ? "move" : "default",
                  }}
                  onMouseDown={(e) => startFieldDrag(e, field, "move")}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (editable) setSelectedField(field);
                  }}
                >
                  {fieldDef.renderPreview ? (
                    fieldDef.renderPreview(value)
                  ) : (
                    <div className="truncate">{value}</div>
                  )}
                  {editable && isSelectedField && !locked && (
                    <div
                      className="absolute w-2.5 h-2.5 rounded-sm bg-primary right-0 bottom-0 cursor-se-resize"
                      onMouseDown={(e) => startFieldDrag(e, field, "resize")}
                    />
                  )}
                </div>
              );
            })}
        </>
      )}

      {/* Editor / hover controls */}
      <div
        className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ zIndex: 3 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="p-1 rounded bg-black/60 hover:bg-black/80 text-white/80 hover:text-white transition-colors shrink-0"
        >
          {isPlaying ? (
            <Pause style={{ width: Math.max(10, 14 * zoom), height: Math.max(10, 14 * zoom) }} />
          ) : (
            <Play style={{ width: Math.max(10, 14 * zoom), height: Math.max(10, 14 * zoom) }} />
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          className="p-1 rounded bg-black/60 hover:bg-black/80 text-white/80 hover:text-white transition-colors shrink-0"
        >
          {muted ? (
            <VolumeX style={{ width: Math.max(10, 14 * zoom), height: Math.max(10, 14 * zoom) }} />
          ) : (
            <Volume2 style={{ width: Math.max(10, 14 * zoom), height: Math.max(10, 14 * zoom) }} />
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            playNext();
          }}
          className="p-1 rounded bg-black/60 hover:bg-black/80 text-white/80 hover:text-white transition-colors shrink-0"
        >
          <SkipForward style={{ width: Math.max(10, 14 * zoom), height: Math.max(10, 14 * zoom) }} />
        </button>
      </div>

      {/* Clip counter */}
      <div
        className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white/60"
        style={{ zIndex: 3, fontSize: Math.max(7, 9 * zoom) }}
      >
        {isRandomMode ? orderPosition + 1 : currentIndex + 1} / {clips.length}
      </div>
    </div>
  );
}
