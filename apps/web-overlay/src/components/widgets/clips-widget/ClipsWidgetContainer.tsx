"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ClipsWidgetRenderer,
  type ClipDataRow,
  type ClipsWidgetConfig,
  DEFAULT_CLIPS_WIDGET_CONFIG,
} from "@repo/ui/overlay";
import type { OverlayWidgetProps } from "@repo/ui/overlay";
import { loadOverlayClipPlaylistForWidget } from "@/actions/clips";
import { getClipDownloadUrl } from "@/actions/twitch";
import type { Json } from "@repo/supabase";

function proxyUrl(signedUrl: string): string {
  return `/api/video?url=${encodeURIComponent(signedUrl)}`;
}

function parseCompositeConfig(raw: unknown): ClipsWidgetConfig {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...DEFAULT_CLIPS_WIDGET_CONFIG, ...(raw as Partial<ClipsWidgetConfig>) };
  }
  return { ...DEFAULT_CLIPS_WIDGET_CONFIG };
}

export function ClipsWidgetContainer({ scene, item }: OverlayWidgetProps) {
  const sceneUserId = scene.user_id;

  // item.config is already the composite config (display fields merged server-side by overlay action)
  const config = useMemo(() => parseCompositeConfig(item.config), [item.config]);

  const refreshMs = Math.min(3600, Math.max(10, config.refreshIntervalSeconds)) * 1000;
  const [refreshEpoch, setRefreshEpoch] = useState(0);

  useEffect(() => {
    const iv = window.setInterval(() => setRefreshEpoch((e) => e + 1), refreshMs);
    return () => window.clearInterval(iv);
  }, [refreshMs]);

  const clipQueryKey = useMemo(
    () =>
      JSON.stringify({
        sceneUserId,
        refreshEpoch,
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
    [sceneUserId, refreshEpoch, config]
  );

  const [clips, setClips] = useState<ClipDataRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    loadOverlayClipPlaylistForWidget(sceneUserId, item.config as unknown as Json).then(
      (rows) => {
        if (cancelled) return;
        const mapped: ClipDataRow[] = rows.map((r) => ({
          clipId: r.twitchClipId,
          broadcasterId: r.broadcasterId,
          title: r.title,
          creatorName: r.creator_name,
          gameName: r.game_name,
          createdAtTwitch: r.created_at_twitch,
          viewCount: r.view_count,
          durationSec: r.duration,
        }));
        setClips(mapped);
        setLoading(false);
      }
    );

    return () => { cancelled = true; };
  }, [clipQueryKey, sceneUserId, item.config]);

  const urlCacheRef = useRef<Record<string, string>>({});

  const resolveClipUrl = useCallback(
    async (clipId: string, broadcasterId: string): Promise<string | null> => {
      const cached = urlCacheRef.current[clipId];
      if (cached) return cached;

      try {
        const signedUrl = await getClipDownloadUrl(clipId, broadcasterId);
        const proxied = proxyUrl(signedUrl);
        urlCacheRef.current[clipId] = proxied;
        return proxied;
      } catch {
        return null;
      }
    },
    []
  );

  return (
    <ClipsWidgetRenderer
      clips={clips}
      loading={loading}
      config={config}
      resolveClipUrl={resolveClipUrl}
    />
  );
}
