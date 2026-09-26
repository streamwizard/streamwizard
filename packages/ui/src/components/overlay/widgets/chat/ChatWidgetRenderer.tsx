"use client";

// Next.js replaces NEXT_PUBLIC_* at build time; declare process so tsc is happy in this library package.
declare const process: { env: Record<string, string | undefined> };

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { CSSProperties } from "react";
import type { ChannelChatMessageEvent, ChannelChatNotificationEvent } from "@repo/schemas";
import { useGoogleFonts } from "../../hooks/use-google-font";
import { subscribeToWsRoom } from "../../lib/ws-store";
import type { OverlayItem, OverlayScene } from "../../types";
import { badgeTitle, badgeUrl, type ChatBadge } from "../../../chat/asset-urls";
import { tokenizeChatMessage } from "../../../chat/tokenize";
import { resolveUserColor } from "../../../chat/user-color";
import {
  createChatAssetFetcher,
  useChatAssets,
  type ChatAssetFetcher,
} from "../../../chat/use-chat-assets";
import type { ChatAssets, ChatToken, ThirdPartyProvider } from "../../../chat/types";
import {
  ALERT_TEST_BROWSER_EVENT,
  type AlertTestBrowserEventDetail,
} from "../alert/alert-widget-config";
import {
  CHAT_WIDGET_EMOTE_PROVIDERS,
  CHAT_WIDGET_LINE_HEIGHT,
  normalizeChatWidgetConfig,
  type ChatWidgetItemConfig,
} from "./chat-widget-config";
import {
  CHAT_WIDGET_FRAME_TYPES,
  applyChatWidgetFrame,
  capChatWidgetRows,
  pruneChatWidgetRows,
  type ChatWidgetFeedOptions,
  type ChatWidgetFrame,
  type ChatWidgetRow,
} from "./chat-widget-feed";

export interface ChatWidgetRendererProps {
  item: OverlayItem;
  /** Needed for the live WS subscription; the editor canvas also passes it. */
  scene?: OverlayScene;
  /** Editor flag: shows a hint while no chat has arrived yet. */
  isEditor?: boolean;
}

/** Frames are buffered and applied together, so a busy chat costs ~10 renders/s at most. */
const FLUSH_MS = 100;
const ENTER_MS = 300;
const EXIT_MS = 400;
const MOVE_MS = 300;

const FRAME_TYPES: ReadonlySet<string> = new Set(CHAT_WIDGET_FRAME_TYPES);

const KEYFRAMES = `
@keyframes sw-chat-in-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes sw-chat-in-slide_up { from { opacity: 0; transform: translateY(0.8em) } to { opacity: 1; transform: none } }
@keyframes sw-chat-in-slide_left { from { opacity: 0; transform: translateX(1.5em) } to { opacity: 1; transform: none } }
@keyframes sw-chat-in-slide_right { from { opacity: 0; transform: translateX(-1.5em) } to { opacity: 1; transform: none } }
@keyframes sw-chat-in-pop {
  0% { opacity: 0; transform: scale(0.6) }
  70% { opacity: 1; transform: scale(1.05) }
  100% { opacity: 1; transform: scale(1) }
}
@keyframes sw-chat-out-fade { from { opacity: 1 } to { opacity: 0 } }
@keyframes sw-chat-out-slide_left { from { opacity: 1; transform: none } to { opacity: 0; transform: translateX(-1.5em) } }
@keyframes sw-chat-out-slide_right { from { opacity: 1; transform: none } to { opacity: 0; transform: translateX(1.5em) } }
@keyframes sw-chat-out-shrink { from { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(0.6) } }
@media (prefers-reduced-motion: reduce) {
  .sw-chat-row { animation-duration: 1ms !important; }
}
`;

// The editor lives on the dashboard origin, which serves the same asset bodies
// behind the streamer's session. Module-level so its identity is stable.
const fetchDashboardChatAsset = createChatAssetFetcher("/api/twitch/assets");

function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n)) return `rgba(0,0,0,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const TEXT_SHADOW = "0 1px 2px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.5)";

// ─── Row pieces ─────────────────────────────────────────────────────────────

function Tokens({ tokens, emoteSize }: { tokens: ChatToken[]; emoteSize: number }) {
  return (
    <>
      {tokens.map((token, index) => {
        switch (token.kind) {
          case "emote": {
            const size = token.big ? emoteSize * 2 : emoteSize;
            return (
              <img
                key={index}
                src={token.url}
                alt={token.name}
                decoding="async"
                style={{
                  display: "inline-block",
                  height: size,
                  maxWidth: size * 4,
                  objectFit: "contain",
                  verticalAlign: "middle",
                  margin: "-0.2em 0.05em",
                }}
              />
            );
          }
          case "cheermote":
            return (
              <span key={index} style={{ whiteSpace: "nowrap" }}>
                {token.url ? (
                  <img
                    src={token.url}
                    alt={token.prefix}
                    decoding="async"
                    style={{
                      display: "inline-block",
                      height: emoteSize,
                      width: emoteSize,
                      verticalAlign: "middle",
                      margin: "-0.2em 0.05em",
                    }}
                  />
                ) : null}
                <span style={{ fontWeight: 700, color: token.color }}>{token.bits}</span>
              </span>
            );
          case "gif":
            return (
              <img
                key={index}
                src={token.url}
                alt={token.alt}
                decoding="async"
                style={{
                  display: "inline-block",
                  height: emoteSize * 3,
                  maxWidth: emoteSize * 8,
                  objectFit: "contain",
                  verticalAlign: "middle",
                  borderRadius: 4,
                  margin: "0.1em 0.05em",
                }}
              />
            );
          case "mention":
            return (
              <span key={index} style={{ fontWeight: 700 }}>
                {token.text}
              </span>
            );
          // Nothing on an overlay is clickable, so a link is just its text.
          default:
            return <span key={index}>{token.text}</span>;
        }
      })}
    </>
  );
}

interface HeaderProps {
  cfg: ChatWidgetItemConfig;
  assets: ChatAssets;
  name: string;
  login: string;
  color: string;
  badges: ChatBadge[];
  avatarUrl?: string;
  /** Plain and Bubbles run the name into the message; Card puts it on its own line. */
  inline: boolean;
}

function Header({ cfg, assets, name, login, color, badges, avatarUrl, inline }: HeaderProps) {
  const icon = Math.round(cfg.fontSize * 1.1);
  const nameColor =
    cfg.nameColorMode === "fixed" ? cfg.nameColor : resolveUserColor(color, login);
  return (
    <>
      {cfg.showAvatars && avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          decoding="async"
          style={{
            display: "inline-block",
            width: icon,
            height: icon,
            borderRadius: "50%",
            verticalAlign: "middle",
            marginRight: "0.3em",
          }}
        />
      ) : null}
      {cfg.showBadges
        ? badges.map((badge, index) => {
            const url = badgeUrl(badge, assets.badges);
            if (!url) return null;
            return (
              <img
                key={`${badge.set_id}:${badge.id}:${index}`}
                src={url}
                alt={badgeTitle(badge, assets.badges)}
                decoding="async"
                style={{
                  display: "inline-block",
                  width: icon * 0.9,
                  height: icon * 0.9,
                  verticalAlign: "middle",
                  marginRight: "0.25em",
                }}
              />
            );
          })
        : null}
      <span style={{ fontWeight: 700, color: nameColor }}>{name}</span>
      {inline ? <span>: </span> : null}
    </>
  );
}

function rowFrame(cfg: ChatWidgetItemConfig, accent?: string): CSSProperties {
  // Horizontal keeps every message on one line. No ellipsis: sub-pixel text
  // widths made messages that fit end in "…" anyway. The row clips instead.
  const line: CSSProperties =
    cfg.layout === "horizontal" ? { whiteSpace: "nowrap" } : { overflowWrap: "anywhere" };
  if (cfg.preset === "plain") {
    return {
      ...line,
      ...(accent ? { borderLeft: `3px solid ${accent}`, paddingLeft: "0.5em" } : {}),
    };
  }
  const bg = hexToRgba(cfg.backgroundColor, cfg.backgroundOpacity);
  return {
    ...line,
    background: bg,
    borderRadius: cfg.radius,
    padding: cfg.preset === "card" ? "0.5em 0.75em" : "0.3em 0.7em",
    alignSelf:
      cfg.layout === "horizontal" ? "auto" : cfg.preset === "bubbles" ? "flex-start" : "stretch",
    maxWidth: "100%",
    boxSizing: "border-box",
    ...(accent ? { borderLeft: `3px solid ${accent}` } : {}),
  };
}

interface RowProps {
  row: ChatWidgetRow;
  cfg: ChatWidgetItemConfig;
  assets: ChatAssets;
  assetsVersion: number;
}

function MessageRow({ message, cfg, assets }: { message: ChannelChatMessageEvent } & Omit<RowProps, "row" | "assetsVersion">) {
  const tokens = useMemo(
    () =>
      tokenizeChatMessage(message.message.fragments, assets, {
        broadcasterUserId: message.broadcaster_user_id,
        gigantified: message.message_type === "power_ups_gigantified_emote",
      }),
    [message, assets],
  );
  const inline = cfg.preset !== "card";
  const emoteSize = Math.round(cfg.fontSize * 1.4);
  const header = (
    <Header
      cfg={cfg}
      assets={assets}
      name={message.chatter_user_name}
      login={message.chatter_user_login}
      color={message.color}
      badges={message.badges as ChatBadge[]}
      avatarUrl={message.user_profile_image_url}
      inline={inline}
    />
  );
  return (
    <div style={rowFrame(cfg)}>
      {inline ? (
        <>
          {header}
          <Tokens tokens={tokens} emoteSize={emoteSize} />
        </>
      ) : (
        <>
          <div style={{ marginBottom: "0.15em" }}>{header}</div>
          <div>
            <Tokens tokens={tokens} emoteSize={emoteSize} />
          </div>
        </>
      )}
    </div>
  );
}

function noticeAccent(notification: ChannelChatNotificationEvent): string {
  const announcement = notification.announcement?.color?.toLowerCase();
  if (notification.notice_type === "announcement" && announcement) {
    switch (announcement) {
      case "blue":
        return "#3b82f6";
      case "green":
        return "#22c55e";
      case "orange":
        return "#f97316";
      case "purple":
        return "#a855f7";
    }
  }
  if (notification.notice_type === "raid") return "#f97316";
  return "#facc15";
}

function NoticeRow({ notification, cfg, assets }: { notification: ChannelChatNotificationEvent } & Omit<RowProps, "row" | "assetsVersion">) {
  const tokens = useMemo(
    () =>
      tokenizeChatMessage(notification.message.fragments, assets, {
        broadcasterUserId: notification.broadcaster_user_id,
      }),
    [notification, assets],
  );
  const emoteSize = Math.round(cfg.fontSize * 1.4);
  // Horizontal rows are one line tall, so the notice and its message sit
  // side by side instead of stacking.
  const horizontal = cfg.layout === "horizontal";
  const Part = horizontal ? "span" : "div";
  return (
    <div style={rowFrame(cfg, noticeAccent(notification))}>
      <Part style={{ fontWeight: 700, fontSize: "0.9em" }}>{notification.system_message}</Part>
      {tokens.length > 0 ? (
        <Part style={horizontal ? { marginLeft: "0.6em" } : { marginTop: "0.15em" }}>
          {notification.chatter_is_anonymous ? null : (
            <Header
              cfg={cfg}
              assets={assets}
              name={notification.chatter_user_name}
              login={notification.chatter_user_login}
              color={notification.color}
              badges={notification.badges as ChatBadge[]}
              avatarUrl={notification.user_profile_image_url}
              inline
            />
          )}
          <Tokens tokens={tokens} emoteSize={emoteSize} />
        </Part>
      ) : null}
    </div>
  );
}

/**
 * The row's CSS animation, from its age rather than from mount. A restyle in
 * the editor re-renders every row and restarts its animation; computing from
 * age means old rows don't replay their entrance and still leave on time.
 */
function rowAnimation(cfg: ChatWidgetItemConfig, ageMs: number): string | undefined {
  const parts: string[] = [];
  if (cfg.animationIn !== "none" && ageMs < ENTER_MS) {
    parts.push(`sw-chat-in-${cfg.animationIn} ${ENTER_MS}ms ease-out both`);
  }
  if (cfg.fadeAfterSeconds > 0) {
    const out = cfg.animationOut === "none" ? null : cfg.animationOut;
    const delay = Math.max(0, cfg.fadeAfterSeconds * 1000 - EXIT_MS - ageMs);
    // "None" still has to vanish at the fade time; a zero-length fade does that.
    parts.push(
      out
        ? `sw-chat-out-${out} ${EXIT_MS}ms ease-in ${delay}ms forwards`
        : `sw-chat-out-fade 1ms linear ${delay + EXIT_MS}ms forwards`,
    );
  }
  return parts.length > 0 ? parts.join(", ") : undefined;
}

/**
 * Rows are frozen once buffered, so only the config (a restyle in the editor)
 * and a late asset prefetch can change a rendered row.
 */
const Row = memo(
  function Row({ row, cfg, assets }: RowProps) {
    const animation = rowAnimation(cfg, Date.now() - row.at);
    // Two boxes: the outer one is what slides when other messages push it
    // along, the inner one plays the in/out animation. Both use transform, so
    // sharing one element would have the keyframes override the slide.
    return (
      <div
        data-chat-row={row.id}
        style={
          // In a row, messages keep their natural width instead of squeezing
          // each other; the one that doesn't fit is clipped at the far edge.
          cfg.layout === "horizontal"
            ? { flexShrink: 0, maxWidth: "100%", overflow: "hidden" }
            : undefined
        }
      >
        <div
          className="sw-chat-row"
          style={{
            animation,
            // Pop and shrink grow out of the line's start, where the name is.
            transformOrigin: "left center",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {row.kind === "message" ? (
            <MessageRow message={row.message} cfg={cfg} assets={assets} />
          ) : (
            <NoticeRow notification={row.notification} cfg={cfg} assets={assets} />
          )}
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.row === next.row && prev.cfg === next.cfg && prev.assetsVersion === next.assetsVersion,
);

// ─── Smooth moves ───────────────────────────────────────────────────────────

// Layout effects only mean something in a browser; the overlay page is also
// rendered on the server.
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The translate a row is currently drawn at, mid-slide or not. */
function currentOffset(el: HTMLElement): { x: number; y: number } {
  const transform = getComputedStyle(el).transform;
  if (!transform || transform === "none") return { x: 0, y: 0 };
  const m = new DOMMatrixReadOnly(transform);
  return { x: m.m41, y: m.m42 };
}

/**
 * Slides rows from where they were drawn to where the new layout puts them
 * (FLIP), when the rows change. Positions are layout offsets, not screen
 * rects, so the editor zoom and the widget's scale frame don't skew the
 * distance. A row caught mid-slide starts from where it currently is, so a
 * burst of messages glides instead of stuttering.
 *
 * A restyle (font size, padding) also moves rows, but only a change to the
 * rows themselves animates; the slider shouldn't make chat swim.
 */
function useSmoothRowMoves(
  containerRef: RefObject<HTMLDivElement | null>,
  rows: ChatWidgetRow[],
  enabled: boolean,
) {
  const positionsRef = useRef(new Map<string, { x: number; y: number }>());
  const lastRowsRef = useRef(rows);

  useBrowserLayoutEffect(() => {
    const container = containerRef.current;
    const rowsChanged = lastRowsRef.current !== rows;
    lastRowsRef.current = rows;
    if (!container) {
      positionsRef.current.clear();
      return;
    }

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const animate = enabled && rowsChanged && !reduceMotion;

    const next = new Map<string, { x: number; y: number }>();
    const moving: HTMLElement[] = [];
    for (const el of container.querySelectorAll<HTMLElement>("[data-chat-row]")) {
      const id = el.dataset.chatRow ?? "";
      const pos = { x: el.offsetLeft, y: el.offsetTop };
      next.set(id, pos);
      const prev = positionsRef.current.get(id);
      if (!animate || !prev) continue;
      const drawn = currentOffset(el);
      const dx = prev.x + drawn.x - pos.x;
      const dy = prev.y + drawn.y - pos.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      moving.push(el);
    }
    positionsRef.current = next;

    if (moving.length === 0) return;
    // Commit the start position before releasing it, or the browser skips
    // straight to the end.
    void container.offsetHeight;
    for (const el of moving) {
      el.style.transition = `transform ${MOVE_MS}ms cubic-bezier(0.2, 0, 0, 1)`;
      el.style.transform = "";
    }
  });
}

// ─── Renderer ───────────────────────────────────────────────────────────────

export function ChatWidgetRenderer({ item, scene, isEditor = false }: ChatWidgetRendererProps) {
  const cfg = useMemo(() => normalizeChatWidgetConfig(item.config), [item.config]);
  useGoogleFonts(useMemo(() => [cfg.fontFamily], [cfg.fontFamily]));

  const token = scene?.subscriber_token;
  const fetcher = useMemo<ChatAssetFetcher | null>(() => {
    if (isEditor) return fetchDashboardChatAsset;
    if (!token) return null;
    return createChatAssetFetcher("/api/twitch", {
      headers: { Authorization: `Bearer ${token}` },
    });
  }, [isEditor, token]);
  const providers = useMemo<ThirdPartyProvider[]>(
    () => CHAT_WIDGET_EMOTE_PROVIDERS.filter((p) => cfg.emoteProviders[p]),
    [cfg.emoteProviders],
  );
  const { assets, version } = useChatAssets(fetcher, { providers });

  const [rows, setRows] = useState<ChatWidgetRow[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  useSmoothRowMoves(containerRef, rows, cfg.animateMove);

  // Read by the flush, which must not re-subscribe on every config edit.
  const feedOptionsRef = useRef<ChatWidgetFeedOptions>(cfg);
  feedOptionsRef.current = cfg;
  const queueRef = useRef<ChatWidgetFrame[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    flushTimerRef.current = null;
    const frames = queueRef.current;
    if (frames.length === 0) return;
    queueRef.current = [];
    const now = Date.now();
    const options = feedOptionsRef.current;
    setRows((prev) => {
      let next = prev;
      for (const frame of frames) next = applyChatWidgetFrame(next, frame, options, now);
      return next;
    });
  }, []);

  const enqueue = useCallback(
    (frame: ChatWidgetFrame) => {
      // Everything else in the room (alerts, geo, OBS state) stops here.
      if (typeof frame?.type !== "string" || !FRAME_TYPES.has(frame.type)) return;
      queueRef.current.push(frame);
      if (flushTimerRef.current === null) flushTimerRef.current = setTimeout(flush, FLUSH_MS);
    },
    [flush],
  );

  // Real chat and Live tests over the scene's WS room. No channel filter: the
  // socket is shared per room, and an alert box on the same scene needs the
  // rest of the feed.
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? "";
    if (!token || !wsUrl) return;
    return subscribeToWsRoom(token, wsUrl, (raw) => enqueue(raw as ChatWidgetFrame));
  }, [token, enqueue]);

  // Editor: Local fires from the demo panel arrive as a browser event. The
  // name says alert because the alert box used it first; it carries any frame.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onTest = (e: Event) => {
      const detail = (e as CustomEvent<AlertTestBrowserEventDetail>).detail;
      if (!detail || (scene && detail.sceneId !== scene.id)) return;
      enqueue(detail.message as ChatWidgetFrame);
    };
    window.addEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
    return () => window.removeEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
  }, [scene, enqueue]);

  useEffect(
    () => () => {
      if (flushTimerRef.current !== null) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
      queueRef.current = [];
    },
    [],
  );

  // The fade animation hides a row; this takes it out of the DOM afterwards.
  useEffect(() => {
    if (cfg.fadeAfterSeconds <= 0) return;
    const id = setInterval(
      () => setRows((prev) => pruneChatWidgetRows(prev, Date.now(), cfg.fadeAfterSeconds)),
      1000,
    );
    return () => clearInterval(id);
  }, [cfg.fadeAfterSeconds]);

  // Lowering the cap in the editor should trim what's already on screen.
  useEffect(() => {
    setRows((prev) => capChatWidgetRows(prev, cfg.maxMessages));
  }, [cfg.maxMessages]);

  if (rows.length === 0) {
    if (!isEditor) return null;
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          border: "1.5px dashed rgba(158,122,255,0.5)",
          borderRadius: 8,
          color: "rgba(255,255,255,0.6)",
          fontFamily: "sans-serif",
          fontSize: 14,
          lineHeight: 1.4,
          textAlign: "center",
          padding: 16,
        }}
      >
        <strong style={{ color: "rgba(255,255,255,0.85)", fontSize: 15 }}>
          Chat shows up here
        </strong>
        <span>
          Open <strong>Demo</strong> and start <strong>Chat messages</strong>, or type something in
          your own Twitch chat.
        </span>
      </div>
    );
  }

  const ordered = cfg.direction === "top_down" ? [...rows].reverse() : rows;
  const horizontal = cfg.layout === "horizontal";

  return (
    <div
      ref={containerRef}
      style={{
        // Positioned so rows' offsetTop/offsetLeft are measured from here.
        position: "relative",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: horizontal ? "row" : "column",
        alignItems: horizontal ? "center" : "stretch",
        justifyContent: cfg.direction === "top_down" ? "flex-start" : "flex-end",
        gap: cfg.gap,
        padding: cfg.padding,
        fontFamily: `"${cfg.fontFamily}", sans-serif`,
        fontSize: cfg.fontSize,
        fontWeight: cfg.fontWeight,
        lineHeight: CHAT_WIDGET_LINE_HEIGHT,
        color: cfg.textColor,
        textShadow: cfg.textShadow ? TEXT_SHADOW : "none",
      }}
    >
      <style>{KEYFRAMES}</style>
      {ordered.map((row) => (
        <Row key={row.id} row={row} cfg={cfg} assets={assets} assetsVersion={version} />
      ))}
    </div>
  );
}
