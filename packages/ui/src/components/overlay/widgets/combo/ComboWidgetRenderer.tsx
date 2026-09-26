"use client";

// Next.js replaces NEXT_PUBLIC_* at build time; declare process so tsc is happy in this library package.
declare const process: { env: Record<string, string | undefined> };

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useGoogleFonts } from "../../hooks/use-google-font";
import { subscribeToWsRoom } from "../../lib/ws-store";
import type { OverlayItem, OverlayScene } from "../../types";
import { twitchEmoteUrl } from "../../../chat/asset-urls";
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
import { EMOTE_WIDGET_EMOTE_PROVIDERS } from "../emote/emote-widget-config";
import { chatMessageAllowed, chatMessageEmoteList, type EmoteWidgetFrame } from "../emote/emote-widget-feed";
import {
  COMBO_PREVIEW_EVENT,
  comboMilestoneLevel,
  normalizeComboWidgetConfig,
  type ComboPreviewDetail,
  type ComboWidgetItemConfig,
} from "./combo-widget-config";
import {
  EMPTY_COMBO_STATE,
  applyComboMessage,
  tickCombos,
  visibleCombos,
  type Combo,
  type ComboRules,
  type ComboState,
} from "./combo-engine";

export interface ComboWidgetRendererProps {
  item: OverlayItem;
  scene?: OverlayScene;
  isEditor?: boolean;
}

const fetchDashboardAsset = createChatAssetFetcher("/api/twitch/assets");

const TICK_MS = 250;
const DEMO_URL = twitchEmoteUrl("25", { big: true });
/** Preview: a quick run up to a milestone so every animation shows once. */
const PREVIEW_HITS = 12;
const PREVIEW_EVERY_MS = 220;

const KEYFRAMES = `
@keyframes sw-combo-in { from { opacity: 0; transform: scale(0.6) } to { opacity: 1; transform: none } }
@keyframes sw-combo-pop {
  0% { transform: scale(1.35) rotate(-6deg) }
  30% { transform: scale(1.15) rotate(4deg) }
  60% { transform: scale(0.95) rotate(-2deg) }
  100% { transform: none }
}
@keyframes sw-combo-big {
  0% { transform: scale(1.9) rotate(-8deg); filter: brightness(1.8) }
  40% { transform: scale(1.2) rotate(5deg) }
  100% { transform: none; filter: none }
}
@keyframes sw-combo-out {
  0% { opacity: 1; transform: scale(1.1) }
  15% { opacity: 1; transform: none }
  70% { opacity: 1 }
  100% { opacity: 0; transform: scale(0.9) }
}
@media (prefers-reduced-motion: reduce) {
  .sw-combo-count { animation: none !important }
}
`;

function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n)) return `rgba(0,0,0,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** The template with `{count}` as its own animated span and `{emote}` filled in. */
function ComboText({ cfg, combo, level, milestone }: { cfg: ComboWidgetItemConfig; combo: Combo; level: number; milestone: boolean }) {
  const parts = cfg.text.split(/(\{count\})/);
  const glow = level > 0 ? `, 0 0 ${8 + level * 8}px ${cfg.accentColor}` : "";
  const out: ReactNode[] = parts.map((part, i) => {
    if (part === "{count}") {
      return (
        <span
          // A new key per count restarts the pop on every hit.
          key={`c${combo.count}`}
          className="sw-combo-count"
          style={{
            display: "inline-block",
            color: cfg.accentColor,
            animation: `${milestone ? "sw-combo-big 600ms" : "sw-combo-pop 360ms"} cubic-bezier(0.2, 0, 0, 1)`,
            textShadow: cfg.textShadow ? `0 2px 8px rgba(0,0,0,0.6)${glow}` : glow.slice(2) || undefined,
          }}
        >
          {combo.count}
        </span>
      );
    }
    return <span key={i}>{part.replace(/\{emote\}/g, combo.code)}</span>;
  });
  return <>{out}</>;
}

function ComboRow({ cfg, combo, sample }: { cfg: ComboWidgetItemConfig; combo: Combo; sample?: boolean }) {
  const level = comboMilestoneLevel(combo.count, cfg.milestones);
  const milestone = cfg.milestones.includes(combo.count);
  const ended = combo.endedAt !== null;
  const scale = cfg.preset === "pill" ? 0.6 : cfg.preset === "stack" ? 1.3 : 1;
  const emoteH = Math.round(cfg.emoteSize * scale);
  const fontSize = Math.round(cfg.fontSize * (cfg.preset === "pill" ? 0.6 : cfg.preset === "stack" ? 1.4 : 1));

  const row: CSSProperties = {
    display: "flex",
    flexDirection: cfg.preset === "stack" ? "column" : "row",
    alignItems: "center",
    gap: cfg.preset === "stack" ? 4 : Math.round(fontSize * 0.35),
    fontSize,
    lineHeight: 1.05,
    whiteSpace: "nowrap",
    opacity: sample ? 0.45 : 1,
    textShadow: cfg.textShadow ? "0 2px 8px rgba(0,0,0,0.6)" : undefined,
    animation: sample
      ? undefined
      : ended
        ? `sw-combo-out ${Math.max(0.3, cfg.lingerSeconds)}s ease-in forwards`
        : "sw-combo-in 300ms cubic-bezier(0.2, 0, 0, 1)",
    ...(cfg.preset === "pill"
      ? {
          background: hexToRgba("#0b0b12", 0.7),
          border: `2px solid ${hexToRgba(cfg.accentColor, 0.5 + Math.min(level, 3) * 0.15)}`,
          borderRadius: 999,
          padding: `${Math.round(fontSize * 0.3)}px ${Math.round(fontSize * 0.7)}px ${Math.round(fontSize * 0.3)}px ${Math.round(fontSize * 0.35)}px`,
        }
      : {}),
  };

  // Bumps the emote on each hit. Done with the Web Animations API rather than
  // a new key, because remounting the <img> would restart an animated emote.
  const emoteRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = emoteRef.current;
    if (sample || !img?.animate) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    img.animate([{ transform: "scale(1.2)" }, { transform: "none" }], { duration: 300, easing: "ease-out" });
  }, [combo.count, sample]);

  return (
    <div style={row}>
      <img
        ref={emoteRef}
        src={combo.url}
        alt={combo.code}
        draggable={false}
        style={{ height: emoteH, width: "auto" }}
      />
      <div>
        <ComboText cfg={cfg} combo={combo} level={level} milestone={milestone && !sample} />
      </div>
    </div>
  );
}

const SAMPLE_COMBO: Combo = {
  id: 0,
  code: "Kappa",
  url: DEMO_URL,
  count: 12,
  users: [],
  startedAt: 0,
  lastAt: 0,
  endedAt: null,
};

export function ComboWidgetRenderer({ item, scene, isEditor = false }: ComboWidgetRendererProps) {
  const cfg = useMemo(() => normalizeComboWidgetConfig(item.config), [item.config]);
  useGoogleFonts(useMemo(() => [cfg.fontFamily], [cfg.fontFamily]));

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

  const [state, setState] = useState<ComboState>(EMPTY_COMBO_STATE);
  const rules: ComboRules = useMemo(
    () => ({
      mode: cfg.mode,
      windowSeconds: cfg.windowSeconds,
      threshold: cfg.threshold,
      countMode: cfg.countMode,
      maxCombos: cfg.maxCombos,
      lingerSeconds: cfg.lingerSeconds,
    }),
    [cfg.mode, cfg.windowSeconds, cfg.threshold, cfg.countMode, cfg.maxCombos, cfg.lingerSeconds],
  );

  // Read by the frame handler, which must not re-subscribe on every config edit.
  const liveRef = useRef({ cfg, assets, rules });
  liveRef.current = { cfg, assets, rules };

  const onFrame = useCallback((frame: EmoteWidgetFrame) => {
    if (frame?.type !== "channel.chat.message") return;
    const { cfg: c, assets: a, rules: r } = liveRef.current;
    const payload = (frame.payload ?? {}) as Record<string, unknown>;
    if (!chatMessageAllowed(payload, c)) return;
    const emotes = chatMessageEmoteList(payload, a, c.blockedEmotes);
    // Time window: a message without emotes changes nothing. Back to back: it
    // breaks every running combo, so it still goes through.
    if (emotes.length === 0 && r.mode === "time_window") return;
    const login = String(payload.chatter_user_login ?? "");
    setState((s) => applyComboMessage(s, { login, emotes, at: Date.now() }, r));
  }, []);

  // Real chat and Live tests over the scene's WS room.
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

  // Editor: Preview runs a quick local combo past the first milestone.
  useEffect(() => {
    if (!isEditor || typeof window === "undefined") return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const onPreview = (e: Event) => {
      const detail = (e as CustomEvent<ComboPreviewDetail>).detail;
      if (!detail || detail.itemId !== item.id) return;
      const run = Date.now();
      const hits = Math.max(PREVIEW_HITS, (liveRef.current.cfg.milestones[0] ?? 0) + 2);
      for (let i = 0; i < hits; i++) {
        timers.push(
          setTimeout(() => {
            setState((s) =>
              applyComboMessage(
                s,
                { login: `preview_${run}_${i}`, emotes: [{ code: "Kappa", url: DEMO_URL }], at: Date.now() },
                // Always counts, whatever the detection settings say.
                { ...liveRef.current.rules, mode: "time_window", countMode: "every" },
              ),
            );
          }, i * PREVIEW_EVERY_MS),
        );
      }
    };
    window.addEventListener(COMBO_PREVIEW_EVENT, onPreview);
    return () => {
      window.removeEventListener(COMBO_PREVIEW_EVENT, onPreview);
      for (const t of timers) clearTimeout(t);
    };
  }, [isEditor, item.id]);

  // Ends quiet combos and clears finished ones. Only runs while there are any.
  const hasCombos = state.combos.length > 0;
  useEffect(() => {
    if (!hasCombos) return;
    const id = setInterval(() => setState((s) => tickCombos(s, Date.now(), liveRef.current.rules)), TICK_MS);
    return () => clearInterval(id);
  }, [hasCombos]);

  const visible = visibleCombos(state);
  const showSample = isEditor && visible.length === 0;
  if (!showSample && visible.length === 0) return null;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: cfg.layout === "horizontal" ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        overflow: "hidden",
        color: cfg.color,
        fontFamily: `"${cfg.fontFamily}", sans-serif`,
        fontWeight: cfg.fontWeight,
      }}
    >
      <style>{KEYFRAMES}</style>
      {showSample ? (
        <ComboRow cfg={cfg} combo={SAMPLE_COMBO} sample />
      ) : (
        visible.map((combo) => <ComboRow key={combo.id} cfg={cfg} combo={combo} />)
      )}
    </div>
  );
}
