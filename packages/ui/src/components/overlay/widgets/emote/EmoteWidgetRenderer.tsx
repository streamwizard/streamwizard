"use client";

// Next.js replaces NEXT_PUBLIC_* at build time; declare process so tsc is happy in this library package.
declare const process: { env: Record<string, string | undefined> };

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { subscribeToWsRoom } from "../../lib/ws-store";
import type { OverlayItem, OverlayScene } from "../../types";
import {
  createChatAssetFetcher,
  useChatAssets,
  type ChatAssetFetcher,
} from "../../../chat/use-chat-assets";
import type { ThirdPartyProvider } from "../../../chat/types";
import {
  ALERT_TEST_BROWSER_EVENT,
  type AlertTestBrowserEventDetail,
} from "../alert/alert-widget-config";
import {
  EMOTE_PREVIEW_EVENT,
  EMOTE_WIDGET_EMOTE_PROVIDERS,
  burstSize,
  normalizeEmoteWidgetConfig,
  type EmoteAnimation,
  type EmotePreviewDetail,
} from "./emote-widget-config";
import { createEmoteEngine, frameOf, type EmoteEngine } from "./emote-engine";
import {
  GLOBAL_TWITCH_EMOTES,
  burstEmoteUrls,
  chatMessageAllowed,
  chatMessageEmotes,
  cooldownAllows,
  emoteWidgetEventOf,
  type ChannelEmoteMap,
  type EmoteWidgetFrame,
} from "./emote-widget-feed";
import { twitchEmoteUrl } from "../../../chat/asset-urls";

export interface EmoteWidgetRendererProps {
  item: OverlayItem;
  scene?: OverlayScene;
  isEditor?: boolean;
}

const fetchDashboardAsset = createChatAssetFetcher("/api/twitch/assets");

/** Emotes the editor drifts across an empty widget, so the widget is visible while you set it up. */
const DEMO_EMOTES = Object.values(GLOBAL_TWITCH_EMOTES).map((id) => twitchEmoteUrl(id, { big: true }));
const DEMO_EVERY_MS = 1200;

/** True when the machine asks for less motion: fewer emotes, no spin. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Warms the browser cache per URL, so an emote's first frames aren't blank.
 * Shared by every emote widget on the page.
 */
const warmed = new Set<string>();

function warmImage(url: string) {
  if (warmed.has(url) || typeof Image === "undefined") return;
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  warmed.add(url);
  // Bounded: a long stream with 7TV sets can see thousands of codes.
  if (warmed.size > 1000) {
    const oldest = warmed.values().next().value;
    if (oldest !== undefined) warmed.delete(oldest);
  }
}

/**
 * Emotes are plain <img> elements moved with transforms, not canvas draws:
 * a canvas only ever paints the first frame of a GIF or animated WebP, and
 * the browser animates an <img> for free. Transform and opacity changes stay
 * on the compositor, so hundreds of them are still cheap in OBS.
 */
function syncNodes(
  layer: HTMLDivElement,
  nodes: Map<number, HTMLImageElement>,
  engine: EmoteEngine,
  w: number,
  h: number,
) {
  const alive = new Set<number>();
  for (const p of engine.particles) {
    alive.add(p.id);
    let img = nodes.get(p.id);
    if (!img) {
      img = document.createElement("img");
      img.src = p.url;
      img.alt = "";
      img.decoding = "async";
      img.draggable = false;
      // Height sets the size; width follows, so wide 7TV emotes stay wide.
      img.style.cssText = `position:absolute;left:0;top:0;height:${p.size}px;width:auto;will-change:transform,opacity;opacity:0`;
      img.onerror = () => {
        img!.style.display = "none";
      };
      layer.appendChild(img);
      nodes.set(p.id, img);
    }
    const f = frameOf(p, w, h);
    img.style.opacity = String(Math.max(0, Math.min(1, f.alpha)));
    img.style.transform =
      `translate3d(${f.x.toFixed(1)}px,${f.y.toFixed(1)}px,0) translate(-50%,-50%)` +
      ` rotate(${f.rotation.toFixed(3)}rad) scale(${Math.max(0, f.scale).toFixed(3)})`;
  }
  for (const [id, img] of nodes) {
    if (alive.has(id)) continue;
    img.remove();
    nodes.delete(id);
  }
}

export function EmoteWidgetRenderer({ item, scene, isEditor = false }: EmoteWidgetRendererProps) {
  const cfg = useMemo(() => normalizeEmoteWidgetConfig(item.config), [item.config]);
  const reduced = usePrefersReducedMotion();

  const token = scene?.subscriber_token;
  const fetcher = useMemo<ChatAssetFetcher | null>(() => {
    if (isEditor) return fetchDashboardAsset;
    if (!token) return null;
    return createChatAssetFetcher("/api/twitch", { headers: { Authorization: `Bearer ${token}` } });
  }, [isEditor, token]);
  const providers = useMemo<ThirdPartyProvider[]>(
    () => EMOTE_WIDGET_EMOTE_PROVIDERS.filter((p) => cfg.emoteProviders[p]),
    [cfg.emoteProviders],
  );
  const { assets } = useChatAssets(fetcher, { providers });

  // The channel's own emotes, for bursts. Loaded once; a failure just means
  // bursts fall back to the emotes in the message, then Kappa.
  const [channelEmotes, setChannelEmotes] = useState<ChannelEmoteMap>({});
  useEffect(() => {
    if (!fetcher) return;
    let cancelled = false;
    void fetcher("emotes", { provider: "twitch" }).then((body) => {
      const emotes = (body as { emotes?: ChannelEmoteMap } | null)?.emotes;
      if (!cancelled && emotes && typeof emotes === "object") setChannelEmotes(emotes);
    });
    return () => {
      cancelled = true;
    };
  }, [fetcher]);

  const engineRef = useRef<EmoteEngine | null>(null);
  if (!engineRef.current) engineRef.current = createEmoteEngine({ max: cfg.maxOnScreen });
  const layerRef = useRef<HTMLDivElement | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const wakeRef = useRef<() => void>(() => {});

  useEffect(() => {
    engineRef.current?.setMax(cfg.maxOnScreen);
  }, [cfg.maxOnScreen]);

  // Read by the frame handler, which must not re-subscribe on every config edit.
  const liveRef = useRef({ cfg, assets, channelEmotes, reduced });
  liveRef.current = { cfg, assets, channelEmotes, reduced };
  const cooldownRef = useRef(new Map<string, number>());

  const spawn = useCallback((urls: string[], animation: EmoteAnimation, count: number) => {
    const engine = engineRef.current;
    if (!engine || urls.length === 0) return;
    const { cfg: c, reduced: r } = liveRef.current;
    const n = r ? Math.max(1, Math.ceil(count / 3)) : count;
    // Warm the images now, so the first frames aren't blank.
    for (const url of urls) warmImage(url);
    engine.spawn(urls, animation, n, { size: c.emoteSize, duration: c.duration, reducedMotion: r });
    wakeRef.current();
  }, []);

  const onFrame = useCallback(
    (frame: EmoteWidgetFrame) => {
      if (typeof frame?.type !== "string") return;
      const { cfg: c, assets: a, channelEmotes: own } = liveRef.current;
      const payload = (frame.payload ?? {}) as Record<string, unknown>;

      if (frame.type === "channel.chat.message") {
        if (!c.chatEnabled || !chatMessageAllowed(payload, c)) return;
        const urls = chatMessageEmotes(payload, a, c);
        if (urls.length === 0) return;
        const login = String(payload.chatter_user_login ?? "").toLowerCase();
        if (!cooldownAllows(cooldownRef.current, login, Date.now(), c.userCooldown)) return;
        // One emote per emote typed, each flying on its own.
        spawn(urls, c.animation, urls.length);
        return;
      }

      const event = emoteWidgetEventOf(frame.type);
      if (!event) return;
      const burst = c.events[event];
      if (!burst.enabled) return;
      // Gift recipients also arrive as channel.subscribe; the gift burst covers them.
      if (event === "sub" && payload.is_gift === true) return;
      const urls = burstEmoteUrls(burst, payload, own, a, c.blockedEmotes);
      spawn(urls, burst.animation, burstSize(burst, event, payload));
    },
    [spawn],
  );

  // Real chat, real events and Live tests over the scene's WS room.
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? "";
    if (!token || !wsUrl) return;
    return subscribeToWsRoom(token, wsUrl, (raw) => onFrame(raw as EmoteWidgetFrame));
  }, [token, onFrame]);

  // Editor: Local test fires arrive as a browser event.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onTest = (e: Event) => {
      const detail = (e as CustomEvent<AlertTestBrowserEventDetail>).detail;
      if (!detail || (scene && detail.sceneId !== scene.id)) return;
      onFrame(detail.message as EmoteWidgetFrame);
    };
    window.addEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
    return () => window.removeEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
  }, [scene, onFrame]);

  // Editor: the settings panel's preview buttons.
  useEffect(() => {
    if (!isEditor || typeof window === "undefined") return;
    const onPreview = (e: Event) => {
      const detail = (e as CustomEvent<EmotePreviewDetail>).detail;
      if (!detail || detail.itemId !== item.id) return;
      const own = Object.values(liveRef.current.channelEmotes).map((em) => em.url_4x);
      spawn(own.length > 0 ? own : DEMO_EMOTES, detail.animation, detail.count);
    };
    window.addEventListener(EMOTE_PREVIEW_EVENT, onPreview);
    return () => window.removeEventListener(EMOTE_PREVIEW_EVENT, onPreview);
  }, [isEditor, item.id, spawn]);

  // Editor: a slow trickle while nothing else is on screen.
  useEffect(() => {
    if (!isEditor) return;
    const id = setInterval(() => {
      const engine = engineRef.current;
      if (!engine || engine.particles.length > 0) return;
      const url = DEMO_EMOTES[Math.floor(Math.random() * DEMO_EMOTES.length)]!;
      spawn([url], liveRef.current.cfg.animation, 1);
    }, DEMO_EVERY_MS);
    return () => clearInterval(id);
  }, [isEditor, spawn]);

  // Layer size, following the widget's box.
  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const fit = () => {
      sizeRef.current = { w: layer.clientWidth, h: layer.clientHeight };
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    ro.observe(layer);
    return () => ro.disconnect();
  }, []);

  // The frame loop. It sleeps while nothing is on screen and a spawn wakes it,
  // so an idle overlay costs no CPU in OBS.
  useEffect(() => {
    const layer = layerRef.current;
    const engine = engineRef.current;
    if (!layer || !engine) return;
    const nodes = new Map<number, HTMLImageElement>();
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      engine.step((now - last) / 1000);
      last = now;
      syncNodes(layer, nodes, engine, sizeRef.current.w, sizeRef.current.h);
      raf = engine.particles.length > 0 ? requestAnimationFrame(tick) : 0;
    };
    wakeRef.current = () => {
      if (raf !== 0) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    wakeRef.current();
    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      wakeRef.current = () => {};
      for (const img of nodes.values()) img.remove();
      nodes.clear();
    };
  }, []);

  return (
    <div
      ref={layerRef}
      aria-hidden
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        pointerEvents: "none",
        contain: "strict",
      }}
    />
  );
}
