"use client";

import {
  loadOverlayClipPlaylistForWidget,
  type OverlayClipForDisplay,
} from "@/actions/clips";
import { getClipDownloadUrl } from "@/actions/twitch";
import type { OverlayWidgetProps } from "@/components/widgets/types";
import {
  CLIP_DISPLAY_FIELD_KEYS,
  type ClipDisplayFieldKey,
} from "@/lib/overlay-field-keys";
import { parseClipsWidgetConfig } from "@/lib/clips-widget-config";
import type { Json } from "@repo/supabase";
import type { CSSProperties, RefObject } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

function proxyUrl(signedUrl: string): string {
  return `/api/video?url=${encodeURIComponent(signedUrl)}`;
}

function cfg(config: Json): Record<string, unknown> {
  return typeof config === "object" && config !== null && !Array.isArray(config)
    ? (config as Record<string, unknown>)
    : {};
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDurationSec(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(r)}`;
  return `${m}:${pad2(r)}`;
}

function formatClipDate(iso: string): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(d));
}

function formatViews(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, {
    notation: n >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n);
}

function fieldText(
  clip: OverlayClipForDisplay,
  key: ClipDisplayFieldKey
): string {
  switch (key) {
    case "title":
      return clip.title;
    case "creator":
      return clip.creator_name;
    case "game":
      return clip.game_name ?? "—";
    case "date":
      return formatClipDate(clip.created_at_twitch);
    case "viewCount":
      return formatViews(clip.view_count);
    case "duration":
      return formatDurationSec(clip.duration);
    default:
      return "";
  }
}

type LayoutBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
};

const DEFAULT_FIELD_LAYOUT: LayoutBox = {
  x: 0,
  y: 88,
  w: 100,
  h: 12,
  fontSize: 16,
};

function parseOverlayClipWidgetUi(config: Json): {
  refreshMs: number;
  clipMuted: boolean;
  clipVolume: number;
  clipTransition: "cut" | "crossfade";
  clipTransitionMs: number;
  displayFields: Record<ClipDisplayFieldKey, boolean>;
  displayFieldLayouts: Partial<Record<ClipDisplayFieldKey, LayoutBox>>;
  displayFieldOrder: ClipDisplayFieldKey[];
} {
  const c = cfg(config);
  const refreshRaw =
    typeof c.refreshIntervalSeconds === "number"
      ? c.refreshIntervalSeconds
      : 300;
  const refreshSec = Math.min(3600, Math.max(10, refreshRaw));
  const clipMuted = c.clipMuted === true;
  const clipVolRaw =
    typeof c.clipVolume === "number" ? c.clipVolume : 1;
  const clipVolume = Math.min(1, Math.max(0, clipVolRaw));
  const clipTransition =
    c.clipTransition === "cut" ? "cut" : "crossfade";
  const trRaw =
    typeof c.clipTransitionMs === "number" ? c.clipTransitionMs : 600;
  const clipTransitionMs = Math.min(3000, Math.max(200, trRaw));

  const displayFields: Record<ClipDisplayFieldKey, boolean> = {
    title: false,
    creator: false,
    game: false,
    date: false,
    viewCount: false,
    duration: false,
  };

  const dfRaw = c.displayFields;
  if (dfRaw && typeof dfRaw === "object" && !Array.isArray(dfRaw)) {
    for (const key of CLIP_DISPLAY_FIELD_KEYS) {
      const v = (dfRaw as Record<string, unknown>)[key];
      displayFields[key] = v === true;
    }
  }

  const layoutsPartial: Partial<Record<ClipDisplayFieldKey, LayoutBox>> = {};
  const dlRaw = c.displayFieldLayouts;
  if (dlRaw && typeof dlRaw === "object" && !Array.isArray(dlRaw)) {
    for (const key of CLIP_DISPLAY_FIELD_KEYS) {
      const ly = (dlRaw as Record<string, unknown>)[key];
      if (ly && typeof ly === "object" && !Array.isArray(ly)) {
        const o = ly as Record<string, unknown>;
        layoutsPartial[key] = {
          x: typeof o.x === "number" ? o.x : 0,
          y: typeof o.y === "number" ? o.y : 0,
          w: typeof o.w === "number" ? o.w : 100,
          h: typeof o.h === "number" ? o.h : 100,
          fontSize:
            typeof o.fontSize === "number" ? o.fontSize : 16,
        };
      }
    }
  }

  let displayFieldOrder: ClipDisplayFieldKey[] = [...CLIP_DISPLAY_FIELD_KEYS];
  const ordRaw = c.displayFieldOrder;
  if (Array.isArray(ordRaw)) {
    const next: ClipDisplayFieldKey[] = [];
    for (const entry of ordRaw) {
      if (
        typeof entry === "string" &&
        (CLIP_DISPLAY_FIELD_KEYS as readonly string[]).includes(entry)
      ) {
        next.push(entry as ClipDisplayFieldKey);
      }
    }
    for (const k of CLIP_DISPLAY_FIELD_KEYS) {
      if (!next.includes(k)) next.push(k);
    }
    displayFieldOrder = next;
  }

  return {
    refreshMs: refreshSec * 1000,
    clipMuted,
    clipVolume,
    clipTransition,
    clipTransitionMs,
    displayFields,
    displayFieldLayouts: layoutsPartial,
    displayFieldOrder,
  };
}

type ResolvedClip = OverlayClipForDisplay & {
  videoUrl?: string;
  failed?: boolean;
};

function shuffleIndices(length: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
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

  let order = shuffleIndices(length);
  if (previousFirst !== undefined && length > 1 && order[0] === previousFirst) {
    const swapIndex = 1 + Math.floor(Math.random() * (length - 1));
    [order[0], order[swapIndex]] = [order[swapIndex], order[0]];
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

export function ClipsWidget({ scene, item }: OverlayWidgetProps) {
  if (!scene) return null;
  const config = item.config as unknown as Json;
  const sceneUserId = scene.user_id;

  const ui = useMemo(() => parseOverlayClipWidgetUi(config), [config]);
  const queryCfg = useMemo(() => parseClipsWidgetConfig(config), [config]);

  const [refreshEpoch, setRefreshEpoch] = useState(0);
  useEffect(() => {
    const iv = window.setInterval(
      () => setRefreshEpoch((e) => e + 1),
      ui.refreshMs
    );
    return () => window.clearInterval(iv);
  }, [ui.refreshMs]);

  const clipQueryKey = useMemo(
    () =>
      JSON.stringify({
        sceneUserId,
        refreshEpoch,
        sourceMode: queryCfg.sourceMode,
        folderIds: queryCfg.folderIds,
        gameIds: queryCfg.gameIds,
        creatorIds: queryCfg.creatorIds,
        timeWindow: queryCfg.timeWindow,
        customDateRange: queryCfg.customDateRange,
        sort: queryCfg.sort,
        maxClips: queryCfg.maxClips,
        minViewCount: queryCfg.minViewCount,
        isFeaturedOnly: queryCfg.isFeaturedOnly,
      }),
    [sceneUserId, refreshEpoch, queryCfg]
  );

  const [clips, setClips] = useState<ResolvedClip[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playOrder, setPlayOrder] = useState<number[]>([]);
  const [orderPosition, setOrderPosition] = useState(0);
  const [isPlaying] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activePlayer, setActivePlayer] = useState<0 | 1>(0);
  const isRandomMode = queryCfg.sort === "random";

  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);

  const urlCacheRef = useRef<Record<string, string>>({});
  const urlFetchInFlightRef = useRef<Set<string>>(new Set());

  const clipCrossfadeMs = useMemo(() => {
    if (ui.clipTransition !== "crossfade") return 0;
    return Math.min(3000, Math.max(200, ui.clipTransitionMs));
  }, [ui.clipTransition, ui.clipTransitionMs]);

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

  const mediaShouldPlay = isPlaying;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    urlCacheRef.current = {};
    urlFetchInFlightRef.current.clear();

    loadOverlayClipPlaylistForWidget(sceneUserId, config).then((rows) => {
      if (cancelled) return;
      const nextClips: ResolvedClip[] = rows.map((c) => ({ ...c }));
      const nextOrder = createPlaybackOrder(
        nextClips.length,
        queryCfg.sort === "random"
      );

      setClips(nextClips);
      setPlayOrder(nextOrder);
      setOrderPosition(0);
      setCurrentIndex(nextOrder[0] ?? 0);
      setActivePlayer(0);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [clipQueryKey, sceneUserId, config]);

  const resolveClipUrl = useCallback(
    async (clip: ResolvedClip): Promise<string | null> => {
      if (clip.videoUrl) return clip.videoUrl;
      if (clip.failed) return null;
      const cachedUrl = urlCacheRef.current[clip.twitchClipId];
      if (cachedUrl) return cachedUrl;

      try {
        const signedUrl = await getClipDownloadUrl(
          clip.twitchClipId,
          clip.broadcasterId
        );
        const proxiedUrl = proxyUrl(signedUrl);
        urlCacheRef.current[clip.twitchClipId] = proxiedUrl;
        return proxiedUrl;
      } catch {
        return null;
      }
    },
    []
  );

  const loadClipIntoPlayer = useCallback(
    async (
      index: number,
      videoRef: RefObject<HTMLVideoElement | null>
    ): Promise<boolean> => {
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

      const el = videoRef.current;
      const targetHref = resolveHref(url);
      if (
        el.currentSrc &&
        (el.currentSrc === targetHref || el.src === targetHref)
      ) {
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

      if (urlCacheRef.current[clip.twitchClipId]) {
        const cached = urlCacheRef.current[clip.twitchClipId];
        setClips((prev) =>
          prev.map((c, i) =>
            i === index ? { ...c, videoUrl: cached } : c
          )
        );
        return;
      }

      if (urlFetchInFlightRef.current.has(clip.twitchClipId)) return;
      urlFetchInFlightRef.current.add(clip.twitchClipId);

      try {
        const url = await resolveClipUrl(clip);
        if (!url) return;

        setClips((prev) =>
          prev.map((c, i) => (i === index ? { ...c, videoUrl: url } : c))
        );
      } finally {
        urlFetchInFlightRef.current.delete(clip.twitchClipId);
      }
    },
    [clips, resolveClipUrl]
  );

  useEffect(() => {
    if (clips.length === 0 || loading) return;
    void loadClipIntoPlayer(currentIndex, getActiveRef());
  }, [clips.length, loading, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps -- mirror ClipVideoPreview

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
    void prefetchClipUrl(nextIndex);
  }, [
    clips,
    currentIndex,
    loading,
    prefetchClipUrl,
    isRandomMode,
    playOrder,
    orderPosition,
  ]);

  const playNext = useCallback(async () => {
    if (clips.length <= 1) {
      const ref = getActiveRef();
      if (ref.current) {
        ref.current.currentTime = 0;
        if (mediaShouldPlay) {
          ref.current.play().catch(() => {});
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

        if (mediaShouldPlay) {
          inactiveEl.play().catch(() => {});
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
  ]);

  useEffect(() => {
    const a = videoRefA.current;
    const b = videoRefB.current;
    if (!a || !b) return;

    if (mediaShouldPlay) {
      const active = activePlayer === 0 ? a : b;
      active.play().catch(() => {});
    } else {
      a.pause();
      b.pause();
    }
  }, [mediaShouldPlay, activePlayer]);

  useEffect(() => {
    const a = videoRefA.current;
    const b = videoRefB.current;
    if (a) {
      a.muted = ui.clipMuted;
      a.volume = ui.clipVolume;
    }
    if (b) {
      b.muted = ui.clipMuted;
      b.volume = ui.clipVolume;
    }
  }, [ui.clipMuted, ui.clipVolume]);

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
        muted={ui.clipMuted}
        playsInline
        onEnded={playNext}
        onCanPlay={() => {
          if (activePlayer === 0 && mediaShouldPlay) {
            videoRefA.current?.play().catch(() => {});
          }
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
        muted={ui.clipMuted}
        playsInline
        onEnded={playNext}
        onCanPlay={() => {
          if (activePlayer === 1 && mediaShouldPlay) {
            videoRefB.current?.play().catch(() => {});
          }
        }}
        onError={() => {
          if (activePlayer === 1) void playNext();
        }}
      />

      {currentClip ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
          }}
        >
          {ui.displayFieldOrder.map((key) => {
            if (!ui.displayFields[key]) return null;
            const layout =
              ui.displayFieldLayouts[key] ?? DEFAULT_FIELD_LAYOUT;
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
                  {fieldText(currentClip, key)}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
