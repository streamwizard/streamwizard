"use client";

// Next.js replaces NEXT_PUBLIC_* at build time; declare process so tsc is happy in this library package.
declare const process: { env: Record<string, string | undefined> };

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useGoogleFont } from "../../hooks/use-google-font";
import { subscribeToWsRoom } from "../../lib/ws-store";
import type { OverlayItem, OverlayScene } from "../../types";
import {
  formatUptime,
  normalizeUptimeWidgetConfig,
  startedAtFrom,
  startedAtFromFrame,
  type FetchedStream,
  type UptimeWidgetFrame,
  type UptimeWidgetItemConfig,
} from "./uptime-widget-config";

export interface UptimeWidgetRendererProps {
  item: OverlayItem;
  /** Needed for the live WS subscription and the stream read on the overlay. */
  scene?: OverlayScene;
  /** Editor flag: reads through the dashboard session and previews while offline. */
  isEditor?: boolean;
}

/** The stream is read again this often; the socket covers the start and end in between. */
const REFRESH_MS = 60_000;

/** What the canvas shows while the channel is offline, so the layout can be judged. */
const PREVIEW_MS = (2 * 3600 + 14 * 60 + 9) * 1000;

const SHADOW = "0 1px 2px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.45)";

const KEYFRAMES = `
@keyframes sw-uptime-dot { 0%, 100% { opacity: 1 } 50% { opacity: 0.35 } }
@media (prefers-reduced-motion: reduce) { .sw-uptime-dot { animation: none !important } }
`;

type Status = "loading" | "ready" | "failed";

function useFetchedStream(isEditor: boolean, token: string | undefined) {
  const [result, setResult] = useState<{ status: Status; startedAt: number | null; at: number }>({
    status: "loading",
    startedAt: null,
    at: 0,
  });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isEditor && !token) return;
    let cancelled = false;
    const url = isEditor ? "/api/twitch/assets/stream" : "/api/twitch/stream";
    const init: RequestInit | undefined = isEditor ? undefined : { headers: { Authorization: `Bearer ${token}` } };
    (async () => {
      try {
        const res = await fetch(url, init);
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { stream?: FetchedStream | null };
        if (cancelled) return;
        setResult({ status: "ready", startedAt: startedAtFrom(body.stream), at: Date.now() });
      } catch {
        // Keep what we had: one failed read shouldn't blank a running clock.
        if (!cancelled) setResult((prev) => ({ ...prev, status: prev.status === "loading" ? "failed" : prev.status, at: Date.now() }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditor, token, refreshKey]);

  useEffect(() => {
    const id = setTimeout(() => setRefreshKey((k) => k + 1), REFRESH_MS);
    return () => clearTimeout(id);
  }, [result.at]);

  return result;
}

function justify(align: UptimeWidgetItemConfig["align"]): string {
  if (align === "left") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
}

export function UptimeWidgetRenderer({ item, scene, isEditor = false }: UptimeWidgetRendererProps) {
  const cfg = useMemo(() => normalizeUptimeWidgetConfig(item.config), [item.config]);
  useGoogleFont(cfg.fontFamily);

  const token = scene?.subscriber_token;
  const fetched = useFetchedStream(isEditor, token);
  // The socket's word wins until the next read replaces it.
  const [pushed, setPushed] = useState<{ startedAt: number | null; at: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? "";
    if (!token || !wsUrl) return;
    return subscribeToWsRoom(token, wsUrl, (raw) => {
      const next = startedAtFromFrame(raw as UptimeWidgetFrame);
      if (next !== undefined) setPushed({ startedAt: next, at: Date.now() });
    });
  }, [token]);

  const startedAt = pushed && pushed.at > fetched.at ? pushed.startedAt : fetched.startedAt;
  const live = startedAt !== null;

  // Once a second while live; nothing to redraw while offline.
  useEffect(() => {
    if (!live) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), cfg.showSeconds ? 1000 : 10_000);
    return () => clearInterval(id);
  }, [live, cfg.showSeconds]);

  const preview = !live && isEditor && cfg.hideWhenOffline;
  if (!live && !isEditor && cfg.hideWhenOffline) return null;

  const time = live ? formatUptime(now - startedAt, cfg.showSeconds) : preview ? formatUptime(PREVIEW_MS, cfg.showSeconds) : cfg.offlineText;
  const label = live || preview ? cfg.label.trim() : "";
  const stacked = cfg.layout === "stacked" && label !== "";
  const dotSize = Math.round(cfg.fontSize * 0.42);

  const text: CSSProperties = {
    fontFamily: `"${cfg.fontFamily}", sans-serif`,
    fontSize: cfg.fontSize,
    fontWeight: cfg.fontWeight,
    color: cfg.color,
    textShadow: cfg.textShadow ? SHADOW : "none",
    lineHeight: 1.2,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: justify(cfg.align),
        padding: "4px 8px",
        // The canvas preview is dimmed so it doesn't read as a live number.
        opacity: preview ? 0.55 : 1,
      }}
      title={preview ? "Preview: shows your real uptime once you're live" : undefined}
    >
      <style>{KEYFRAMES}</style>
      <div
        style={{
          ...text,
          display: "flex",
          flexDirection: stacked ? "column" : "row",
          alignItems: stacked ? (cfg.align === "left" ? "flex-start" : cfg.align === "right" ? "flex-end" : "center") : "center",
          gap: stacked ? Math.round(cfg.fontSize * 0.05) : Math.round(cfg.fontSize * 0.35),
          maxWidth: "100%",
        }}
      >
        {(label !== "" || (cfg.showDot && (live || preview))) && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: Math.round(cfg.fontSize * 0.35) }}>
            {cfg.showDot && (live || preview) && (
              <span
                className="sw-uptime-dot"
                aria-hidden
                style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: 9999,
                  background: cfg.dotColor,
                  boxShadow: `0 0 ${Math.round(dotSize * 0.8)}px ${cfg.dotColor}`,
                  animation: "sw-uptime-dot 1600ms ease-in-out infinite",
                  flexShrink: 0,
                }}
              />
            )}
            {label !== "" && <span style={stacked ? { fontSize: Math.round(cfg.fontSize * 0.6), opacity: 0.85 } : undefined}>{label}</span>}
          </span>
        )}
        <span>{time}</span>
      </div>
    </div>
  );
}
