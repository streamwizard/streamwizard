"use client";

// Next.js replaces NEXT_PUBLIC_* at build time; declare process so tsc is happy in this library package.
declare const process: { env: Record<string, string | undefined> };

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useGoogleFonts } from "../../hooks/use-google-font";
import { subscribeToWsRoom } from "../../lib/ws-store";
import type { OverlayItem, OverlayScene } from "../../types";
import {
  alertEffectKeyframes,
  alertEffectStyle,
  type AlertHighlightAnimation,
} from "./alert-animations";
import {
  ALERT_TEST_BROWSER_EVENT,
  alertAmountText,
  alertFontFamilies,
  alertForcedVariationId,
  alertInstanceFromSocketMessage,
  alertLiveLook,
  alertMediaOutAtMs,
  alertTimeline,
  ALERT_MAX_HOLD_MS,
  alertSkipReason,
  clampAlertOutAtMs,
  normalizeAlertWidgetConfig,
  pickAlertVariation,
  renderAlertTemplate,
  type AlertEventType,
  type AlertInstance,
  type AlertPresentation,
  type AlertTestBrowserEventDetail,
} from "./alert-widget-config";

export interface AlertWidgetRendererProps {
  item: OverlayItem;
  /** Needed for the live WS subscription; the editor canvas also passes it. */
  scene?: OverlayScene;
  /**
   * Editor flag: shows a placeholder while idle so the box stays visible on the
   * canvas. The WS subscription runs either way -- only Local-mode tests take
   * the `streamwizard:test-alert` browser event instead.
   */
  isEditor?: boolean;
}

type Phase = "in" | "hold" | "out";
/**
 * The text keeps its own time inside the alert's: it can arrive late and leave
 * early. `waiting` and `gone` hold its place without showing it, so the media
 * does not shift when it appears.
 */
type TextPhase = "waiting" | "in" | "out" | "gone";

interface QueuedAlert {
  alert: AlertInstance;
  /** The alert's own look, or that of the variation picked for this event. */
  variant: AlertPresentation;
  /** The variation picked, or null for the alert itself: where `variant` came from. */
  variationId: string | null;
}

interface ActiveAlert extends QueuedAlert {
  /**
   * Counts up per alert played. The media is keyed on it: two alerts sharing a
   * file would otherwise reuse the element, and a video that already ran to
   * its end just sits on its last frame.
   */
  seq: number;
}

/** How long one loop of a highlight effect takes: the pace animate.css draws them at. */
const HIGHLIGHT_LOOP_MS = 1000;
/** How far apart the letters of a wave start, so it travels along the word. */
const WAVE_STAGGER_MS = 70;

const REDUCED_MOTION_CSS = `
@media (prefers-reduced-motion: reduce) {
  .sw-alert-anim { animation-duration: 1ms !important; }
  .sw-alert-loop { animation: none !important; }
}
`;

/**
 * Renders a title template as React nodes with `{name}` / `{amount}`
 * highlighted in the accent color.
 */
function renderAccentedTemplate(
  template: string,
  alert: AlertInstance,
  accentColor: string,
  highlight: AlertHighlightAnimation
): ReactNode[] {
  const loop = alertEffectStyle(highlight, HIGHLIGHT_LOOP_MS, true);
  const parts = template.split(/(\{name\}|\{amount\})/g);
  return parts.map((part, i) => {
    if (part === "{name}" || part === "{amount}") {
      const text = part === "{name}" ? alert.name : alertAmountText(alert);
      if (!loop) {
        return (
          <span key={i} style={{ color: accentColor }}>
            {text}
          </span>
        );
      }
      // A wave is each letter rising in turn; every other effect moves the
      // word as one. Either way it has to be a box: inline text ignores
      // transforms.
      if (highlight === "wave") {
        return (
          <span key={i} style={{ color: accentColor, whiteSpace: "pre" }}>
            {[...text].map((letter, n) => (
              <span
                key={n}
                className="sw-alert-loop"
                style={{ display: "inline-block", ...loop, animationDelay: `${n * WAVE_STAGGER_MS}ms` }}
              >
                {letter}
              </span>
            ))}
          </span>
        );
      }
      return (
        <span
          key={i}
          className="sw-alert-loop"
          style={{ display: "inline-block", color: accentColor, ...loop }}
        >
          {text}
        </span>
      );
    }
    return <span key={i}>{renderAlertTemplate(part, alert)}</span>;
  });
}

export function AlertWidgetRenderer({ item, scene, isEditor = false }: AlertWidgetRendererProps) {
  const cfg = useMemo(() => normalizeAlertWidgetConfig(item.config), [item.config]);
  const fontFamilies = useMemo(() => alertFontFamilies(cfg), [cfg]);
  useGoogleFonts(fontFamilies);


  const [active, setActive] = useState<ActiveAlert | null>(null);
  const [phase, setPhase] = useState<Phase>("in");
  const [textPhase, setTextPhase] = useState<TextPhase>("in");

  const queueRef = useRef<QueuedAlert[]>([]);
  const seqRef = useRef(0);
  // The biggest amount each event type has had since this overlay loaded: what
  // "biggest of the stream" variations measure against. It lives with the page,
  // so reloading the browser source starts the count again.
  const sessionTopRef = useRef<Partial<Record<AlertEventType, number>>>({});
  const busyRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  // Everything from the exit on is rescheduled once a media-matched video
  // reports its real length, so each timer lives in a ref instead of a
  // fire-and-forget list.
  const startedAtRef = useRef(0);
  // The alert on screen, for the timers: they outlive the render that set them.
  const currentRef = useRef<QueuedAlert | null>(null);
  type Timer = ReturnType<typeof setTimeout> | null;
  const inTimerRef = useRef<Timer>(null);
  const textInTimerRef = useRef<Timer>(null);
  const outTimerRef = useRef<Timer>(null);
  const textOutTimerRef = useRef<Timer>(null);
  const textGoneTimerRef = useRef<Timer>(null);
  const hideTimerRef = useRef<Timer>(null);
  const nextTimerRef = useRef<Timer>(null);
  const soundCapTimerRef = useRef<Timer>(null);
  const playNextRef = useRef<() => void>(() => {});

  const stopAudio = () => {
    audioRef.current?.pause();
    audioRef.current = null;
  };

  /**
   * Schedules everything from the exit on, for an alert held `holdMs` before it
   * leaves. Safe to call again mid-alert: the pending set is replaced.
   */
  const scheduleOut = useCallback((holdMs: number) => {
    const c = cfgRef.current;
    const current = currentRef.current;
    if (!current) return;
    for (const t of [
      outTimerRef,
      textOutTimerRef,
      textGoneTimerRef,
      hideTimerRef,
      nextTimerRef,
      soundCapTimerRef,
    ]) {
      if (t.current) clearTimeout(t.current);
    }

    const timeline = alertTimeline(current.variant, clampAlertOutAtMs(holdMs, 0));
    const elapsed = Date.now() - startedAtRef.current;
    const from = (atMs: number) => Math.max(0, atMs - elapsed);

    outTimerRef.current = setTimeout(() => setPhase("out"), from(timeline.outAtMs));
    textOutTimerRef.current = setTimeout(() => setTextPhase("out"), from(timeline.textOutAtMs));
    textGoneTimerRef.current = setTimeout(
      () => setTextPhase("gone"),
      from(timeline.textOutAtMs + timeline.textExitMs)
    );
    // Unmount as soon as the exit has played, not after the gap: a video with
    // sound would otherwise keep looping, unseen, until the next alert.
    hideTimerRef.current = setTimeout(() => setActive(null), from(timeline.endAtMs));

    // The sound file is left to ring out through the gap. Past it the next
    // alert cuts it off, unless the box is set to let sounds finish.
    nextTimerRef.current = setTimeout(
      () => {
        let moved = false;
        const audio = audioRef.current;
        const moveOn = () => {
          if (moved) return;
          moved = true;
          if (soundCapTimerRef.current) clearTimeout(soundCapTimerRef.current);
          audio?.removeEventListener("ended", moveOn);
          stopAudio();
          playNextRef.current();
        };
        if (c.waitForSound && audio && !audio.paused && !audio.ended) {
          audio.addEventListener("ended", moveOn);
          // A sound that never ends, or never reports that it did, must not
          // hold the queue for good.
          soundCapTimerRef.current = setTimeout(
            moveOn,
            Math.max(0, ALERT_MAX_HOLD_MS - (Date.now() - startedAtRef.current))
          );
        } else {
          moveOn();
        }
      },
      from(timeline.endAtMs) + c.gapSeconds * 1000
    );
  }, []);

  const playNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      busyRef.current = false;
      setActive(null);
      return;
    }
    busyRef.current = true;
    const c = cfgRef.current;

    startedAtRef.current = Date.now();
    currentRef.current = next;
    const timeline = alertTimeline(next.variant, next.variant.durationSeconds * 1000);
    setActive({ ...next, seq: ++seqRef.current });
    setPhase(timeline.enterMs > 0 ? "in" : "hold");
    setTextPhase(timeline.textInAtMs > 0 ? "waiting" : "in");

    const soundUrl = next.variant.soundUrl;
    if (soundUrl) {
      const audio = new Audio(soundUrl);
      audio.volume = Math.min(1, Math.max(0, next.variant.volume * c.masterVolume));
      audioRef.current = audio;
      audio.play().catch(() => {});
    }

    if (inTimerRef.current) clearTimeout(inTimerRef.current);
    if (textInTimerRef.current) clearTimeout(textInTimerRef.current);
    if (timeline.enterMs > 0) {
      inTimerRef.current = setTimeout(() => setPhase("hold"), timeline.enterMs);
    }
    if (timeline.textInAtMs > 0) {
      textInTimerRef.current = setTimeout(() => setTextPhase("in"), timeline.textInAtMs);
    }
    // Media-matched alerts start on this too: it is the fallback if the video's
    // length never resolves, and the cap if playback stalls forever.
    scheduleOut(timeline.outAtMs);
  }, [scheduleOut]);
  playNextRef.current = playNext;

  const enqueue = useCallback(
    (alert: AlertInstance, forcedVariationId: string | null = null) => {
      const c = cfgRef.current;
      const variant = c.variants[alert.event];

      // A test of one variation plays it outright: no gate, no condition, no
      // chance roll, and no entry in the stream's records.
      const forced = forcedVariationId
        ? variant.variations.find((v) => v.id === forcedVariationId)
        : undefined;

      let picked = forced ?? null;
      if (!forced) {
        const sessionTop = sessionTopRef.current[alert.event] ?? 0;
        if (alert.amount > sessionTop) sessionTopRef.current[alert.event] = alert.amount;
        if (alertSkipReason(alert, variant)) return;
        picked = pickAlertVariation(alert, variant, { random: Math.random, sessionTop });
      }
      const look: AlertPresentation = picked?.settings ?? variant;

      // Full line: drop it. A follow-bot wave must not book the box for hours.
      if (queueRef.current.length >= c.maxQueue) return;
      queueRef.current.push({ alert, variant: look, variationId: picked?.id ?? null });
      if (!busyRef.current) playNext();
    },
    [playNext]
  );

  // Real + test events over the scene's WS room. The editor canvas joins it
  // too: custom widgets on the same canvas already do, so an alert box that sat
  // out read as broken next to one that reacted. It also means a Live test --
  // and a real sub mid-edit -- plays in the preview and on every open overlay
  // at once, which is the point of Live.
  useEffect(() => {
    const token = scene?.subscriber_token;
    const wsUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? "";
    if (!token || !wsUrl) return;
    return subscribeToWsRoom(token, wsUrl, (raw) => {
      const message = raw as { type?: string; payload?: unknown };
      const alert = alertInstanceFromSocketMessage(message);
      if (alert) enqueue(alert, alertForcedVariationId(message.payload, item.id));
    });
  }, [scene?.subscriber_token, enqueue, item.id]);

  // Editor: local test fires from the inspector and the demo bar (no server
  // round-trip). Anything that isn't an alert maps to null and is ignored.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onTest = (e: Event) => {
      const detail = (e as CustomEvent<AlertTestBrowserEventDetail>).detail;
      if (!detail || (scene && detail.sceneId !== scene.id)) return;
      const alert = alertInstanceFromSocketMessage(detail.message);
      if (alert) enqueue(alert, alertForcedVariationId(detail.message.payload, item.id));
    };
    window.addEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
    return () => window.removeEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
  }, [scene, enqueue, item.id]);

  // Cleanup timers/audio on unmount.
  useEffect(() => {
    const timers = [
      inTimerRef,
      textInTimerRef,
      outTimerRef,
      textOutTimerRef,
      textGoneTimerRef,
      hideTimerRef,
      nextTimerRef,
      soundCapTimerRef,
    ];
    return () => {
      for (const t of timers) if (t.current) clearTimeout(t.current);
      stopAudio();
    };
  }, []);

  if (!active) {
    if (!isEditor) return null;
    // Canvas placeholder so the (invisible while idle) box stays findable.
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1.5px dashed rgba(158,122,255,0.5)",
          borderRadius: 8,
          color: "rgba(255,255,255,0.55)",
          fontFamily: "sans-serif",
          fontSize: 14,
          textAlign: "center",
          padding: 8,
        }}
      >
        Alert box — use Test in the panel to preview
      </div>
    );
  }

  const { alert, seq } = active;
  // Text and typography follow the settings while the alert plays, so an edit
  // shows on the alert being tested. Its timing and media stay as started.
  const variant = alertLiveLook(cfg, alert.event, active.variationId, active.variant);
  const fontFamily = `"${variant.fontFamily}", sans-serif`;
  const textShadow = variant.textShadow ? "0 2px 8px rgba(0,0,0,0.6)" : "none";
  const alignItems =
    variant.align === "left"
      ? "flex-start"
      : variant.align === "right"
        ? "flex-end"
        : "center";
  const mediaUrl = variant.mediaUrl;
  const mediaKind = variant.mediaKind;
  const hasSeparateSound = Boolean(variant.soundUrl);
  const videoVolume = hasSeparateSound
    ? 0
    : Math.min(1, Math.max(0, variant.volume * cfg.masterVolume));
  // Only a video can drive its own timing; without one the fixed duration
  // already scheduled in playNext stands.
  const matchVideo = mediaKind === "video" && variant.durationMode === "media";

  const media =
    mediaUrl && mediaKind === "video" ? (
      <video
        key={seq}
        src={mediaUrl}
        autoPlay
        loop={!matchVideo}
        playsInline
        muted={videoVolume === 0}
        ref={(el) => {
          if (el) el.volume = videoVolume;
        }}
        onLoadedMetadata={(e) => {
          if (!matchVideo) return;
          const el = e.currentTarget;
          // Null when the length is unknown: leave the fixed duration in place
          // and let onEnded close the alert instead.
          const outAt = alertMediaOutAtMs(
            Date.now() - startedAtRef.current,
            el.duration,
            el.currentTime
          );
          if (outAt !== null) scheduleOut(outAt);
        }}
        onEnded={() => {
          if (!matchVideo) return;
          scheduleOut(Date.now() - startedAtRef.current);
        }}
        style={{
          maxWidth: "100%",
          maxHeight: variant.layout === "overlay" ? "100%" : "60%",
          objectFit: "contain",
          ...(variant.layout === "overlay"
            ? { position: "absolute" as const, inset: 0, width: "100%", height: "100%" }
            : {}),
        }}
      />
    ) : mediaUrl && mediaKind === "image" ? (
      <img
        key={seq}
        src={mediaUrl}
        alt=""
        style={{
          maxWidth: "100%",
          maxHeight: variant.layout === "overlay" ? "100%" : "60%",
          objectFit: "contain",
          ...(variant.layout === "overlay"
            ? { position: "absolute" as const, inset: 0, width: "100%", height: "100%" }
            : {}),
        }}
      />
    ) : null;

  const title = (
    <div
      style={{
        color: variant.titleColor,
        fontSize: variant.fontSize,
        fontWeight: variant.fontWeight,
        fontFamily,
        textAlign: variant.align,
        textShadow,
        lineHeight: 1.2,
        wordBreak: "break-word",
      }}
    >
      {renderAccentedTemplate(
        variant.titleTemplate,
        alert,
        variant.accentColor,
        variant.highlightAnimation
      )}
    </div>
  );

  const messageText = variant.messageTemplate
    ? renderAlertTemplate(variant.messageTemplate, alert).trim()
    : "";
  const message = messageText ? (
    <div
      style={{
        color: variant.messageColor,
        fontSize: Math.round(variant.fontSize * 0.6),
        fontWeight: 400,
        fontFamily,
        textAlign: variant.align,
        textShadow,
        lineHeight: 1.3,
        wordBreak: "break-word",
      }}
    >
      {messageText}
    </div>
  ) : null;

  // Only the lengths are read here, and those do not depend on the hold.
  const timeline = alertTimeline(variant, 0);
  const alertMotion =
    phase === "in"
      ? alertEffectStyle(variant.animationIn, timeline.enterMs)
      : phase === "out"
        ? alertEffectStyle(variant.animationOut, timeline.exitMs)
        : null;
  const textMotion =
    textPhase === "in"
      ? alertEffectStyle(variant.textAnimationIn, timeline.textEnterMs)
      : textPhase === "out"
        ? alertEffectStyle(variant.textAnimationOut, timeline.textExitMs)
        : null;
  // Out of sight but still taking its room, so the media stays where it is
  // while the text is yet to arrive or already gone. An exit with no effect is
  // gone the moment it starts.
  const textHidden =
    textPhase === "waiting" || textPhase === "gone" || (textPhase === "out" && !textMotion);

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
      <style>
        {REDUCED_MOTION_CSS +
          alertEffectKeyframes([
            variant.animationIn,
            variant.animationOut,
            variant.textAnimationIn,
            variant.textAnimationOut,
            variant.highlightAnimation,
          ])}
      </style>
      <div
        className="sw-alert-anim"
        style={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          position: "relative",
          display: "flex",
          flexDirection: variant.layout === "row" ? "row" : "column",
          alignItems: variant.layout === "row" ? "center" : alignItems,
          justifyContent: "center",
          gap: 12,
          padding: 8,
          ...(alertMotion ?? { animation: "none" }),
        }}
      >
        {media}
        <div
          className="sw-alert-anim"
          data-alert-text=""
          style={{
            position: variant.layout === "overlay" ? "relative" : "static",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems,
            gap: 4,
            minWidth: 0,
            visibility: textHidden ? "hidden" : "visible",
            ...(textMotion ?? { animation: "none" }),
          }}
        >
          {title}
          {message}
        </div>
      </div>
    </div>
  );
}
