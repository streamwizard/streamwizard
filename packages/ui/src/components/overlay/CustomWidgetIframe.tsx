"use client";

// Next.js replaces NEXT_PUBLIC_* at build time; declare process so tsc is happy in this library package.
declare const process: { env: Record<string, string | undefined> };

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { subscribeToWsRoomWith, wsStatusFromMessage, type WsRoomOptions, type WsRoomStatus } from "./lib/ws-store";
import { useIrlGeoContext } from "./hooks/use-irl-geo-context";

export interface CustomWidgetIframeHandle {
  postMessage: (msg: unknown) => void;
}

/** A log line the widget's own code produced inside the sandbox. */
export interface WidgetLogEntry {
  level: "log" | "info" | "warn" | "error";
  text: string;
  ts: number;
}

export interface CustomWidgetIframeProps {
  srcdoc: string;
  fieldData: Record<string, unknown>;
  userId?: string;
  subscriberToken?: string;
  /**
   * Auth for callers whose credential isn't a scene subscriber token (the widget
   * editor uses the signed-in user's Supabase JWT). Takes precedence over
   * `subscriberToken`. Memoize it — identity changes reconnect the socket.
   */
  wsRoom?: WsRoomOptions;
  onWsStatus?: (status: WsRoomStatus) => void;
  onLog?: (entry: WidgetLogEntry) => void;
  /**
   * Fires after `fieldData` is pushed into a loaded document. `handled` is
   * false when the widget never listens for 'onFieldsUpdate', which means the
   * new values are only on screen after a reload.
   */
  onFieldDataApplied?: (handled: boolean) => void;
  /**
   * Bump to reload the document even though `srcdoc` is unchanged -- a field
   * only the widget's script reads produces a byte-identical document.
   */
  reloadToken?: number;
  overlayItemId?: string;
  style?: React.CSSProperties;
  className?: string;
  title?: string;
}

export const CustomWidgetIframe = forwardRef<CustomWidgetIframeHandle, CustomWidgetIframeProps>(
  function CustomWidgetIframe({ srcdoc, fieldData, userId = "", subscriberToken, wsRoom, onWsStatus, onLog, onFieldDataApplied, reloadToken, overlayItemId, style, className, title = "custom widget" }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const fieldDataRef = useRef(fieldData);
    fieldDataRef.current = fieldData;
    const onFieldDataAppliedRef = useRef(onFieldDataApplied);
    onFieldDataAppliedRef.current = onFieldDataApplied;
    // Pushing before the document exists would be dropped; the load handshake
    // carries the first delivery.
    const loadedRef = useRef(false);
    // Held in refs so a caller passing inline callbacks doesn't resubscribe every render.
    const onWsStatusRef = useRef(onWsStatus);
    onWsStatusRef.current = onWsStatus;
    const onLogRef = useRef(onLog);
    onLogRef.current = onLog;

    useImperativeHandle(ref, () => ({
      postMessage: (msg) => iframeRef.current?.contentWindow?.postMessage(msg, "*"),
    }), []);

    // Forward console output and uncaught errors from inside the sandbox.
    useEffect(() => {
      if (!onLog) return;
      function handle(e: MessageEvent) {
        if (e.source !== iframeRef.current?.contentWindow) return;
        const data = e.data as { type?: string; level?: string; text?: string };
        if (data?.type !== "swLog") return;
        onLogRef.current?.({
          level: (data.level as WidgetLogEntry["level"]) ?? "log",
          text: String(data.text ?? ""),
          ts: Date.now(),
        });
      }
      window.addEventListener("message", handle);
      return () => window.removeEventListener("message", handle);
    }, [onLog]);

    useEffect(() => {
      const iframe = iframeRef.current;
      if (!iframe || !srcdoc) return;

      const sendLoad = () => {
        loadedRef.current = true;
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: "onWidgetLoad",
            payload: {
              fieldData: fieldDataRef.current,
              channel: { user_id: userId },
              session: { subscriberToken, overlayItemId },
            },
          },
          "*"
        );
      };

      // Attach listener before setting srcdoc so the load event is never missed.
      // The browser fires load as an async task, so this is always in time.
      loadedRef.current = false;
      iframe.addEventListener("load", sendLoad, { once: true });
      iframe.srcdoc = srcdoc;

      return () => iframe.removeEventListener("load", sendLoad);
    // userId is intentionally excluded — it doesn't change the document, only the payload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [srcdoc, reloadToken]);

    // Settings changed under a document that is already running. Widgets that
    // listen for it update in place; the reply says whether this one did.
    useEffect(() => {
      if (!loadedRef.current) return;
      iframeRef.current?.contentWindow?.postMessage({ type: "swFieldData", fieldData }, "*");
    }, [fieldData]);

    useEffect(() => {
      function handle(e: MessageEvent) {
        if (e.source !== iframeRef.current?.contentWindow) return;
        const data = e.data as { type?: string; handled?: boolean };
        if (data?.type !== "swFieldDataApplied") return;
        onFieldDataAppliedRef.current?.(data.handled === true);
      }
      window.addEventListener("message", handle);
      return () => window.removeEventListener("message", handle);
    }, []);

    useEffect(() => {
      const wsUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? "";
      if (!wsUrl) return;
      const opts: WsRoomOptions | null =
        wsRoom ??
        (subscriberToken
          ? { roomKey: subscriberToken, wsUrl, getToken: () => subscriberToken }
          : null);
      if (!opts) {
        onWsStatusRef.current?.("disconnected");
        return;
      }
      return subscribeToWsRoomWith(opts, (raw) => {
        const status = wsStatusFromMessage(raw);
        if (status) {
          onWsStatusRef.current?.(status);
          return;
        }
        const msg = raw as { type?: string; payload?: unknown };
        if (!msg.type || msg.type.startsWith("ws:")) return;
        iframeRef.current?.contentWindow?.postMessage(
          { type: "onEventReceived", payload: { listener: msg.type, event: msg.payload } },
          "*"
        );
      });
    }, [subscriberToken, wsRoom]);

    // In phone mode, forward local GPS into the iframe using the same event
    // format as WS events so widget authors don't need separate handling. That
    // means the {status, payload} envelope ws-server broadcasts, not a bare
    // GeoPayload -- null here is "provider mounted, no fix yet", which reads
    // the same as the publisher being gone.
    const contextGeo = useIrlGeoContext();
    useEffect(() => {
      if (contextGeo === undefined) return; // OBS mode — WS handles geo
      const event = contextGeo
        ? { status: "connected", payload: contextGeo }
        : { status: "offline" };
      iframeRef.current?.contentWindow?.postMessage(
        { type: "onEventReceived", payload: { listener: "streamwizard.geo", event } },
        "*"
      );
    }, [contextGeo]);

    return (
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts"
        style={{ border: "none", background: "transparent", colorScheme: "normal", ...style }}
        className={className}
        title={title}
      />
    );
  }
);
