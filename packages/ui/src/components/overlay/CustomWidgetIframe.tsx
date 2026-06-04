"use client";

// Next.js replaces NEXT_PUBLIC_* at build time; declare process so tsc is happy in this library package.
declare const process: { env: Record<string, string | undefined> };

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { subscribeToWsRoom } from "./lib/ws-store";
import { useIrlGeoContext } from "./hooks/use-irl-geo-context";

export interface CustomWidgetIframeHandle {
  postMessage: (msg: unknown) => void;
}

export interface CustomWidgetIframeProps {
  srcdoc: string;
  fieldData: Record<string, unknown>;
  userId?: string;
  subscriberToken?: string;
  overlayItemId?: string;
  style?: React.CSSProperties;
  className?: string;
  title?: string;
}

export const CustomWidgetIframe = forwardRef<CustomWidgetIframeHandle, CustomWidgetIframeProps>(
  function CustomWidgetIframe({ srcdoc, fieldData, userId = "", subscriberToken, overlayItemId, style, className, title = "custom widget" }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const fieldDataRef = useRef(fieldData);
    fieldDataRef.current = fieldData;

    useImperativeHandle(ref, () => ({
      postMessage: (msg) => iframeRef.current?.contentWindow?.postMessage(msg, "*"),
    }), []);

    useEffect(() => {
      const iframe = iframeRef.current;
      if (!iframe || !srcdoc) return;

      const sendLoad = () => {
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
      iframe.addEventListener("load", sendLoad, { once: true });
      iframe.srcdoc = srcdoc;

      return () => iframe.removeEventListener("load", sendLoad);
    // userId is intentionally excluded — it doesn't change the document, only the payload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [srcdoc]);

    useEffect(() => {
      if (!subscriberToken) return;
      const wsUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? "";
      if (!wsUrl) return;
      return subscribeToWsRoom(subscriberToken, wsUrl, (raw) => {
        const msg = raw as { type?: string; payload?: unknown };
        if (!msg.type || msg.type.startsWith("ws:")) return;
        iframeRef.current?.contentWindow?.postMessage(
          { type: "onEventReceived", payload: { listener: msg.type, event: msg.payload } },
          "*"
        );
      });
    }, [subscriberToken]);

    // In phone mode, forward local GPS into the iframe using the same event
    // format as WS events so widget authors don't need separate handling.
    const contextGeo = useIrlGeoContext();
    useEffect(() => {
      if (contextGeo === undefined) return; // OBS mode — WS handles geo
      iframeRef.current?.contentWindow?.postMessage(
        { type: "onEventReceived", payload: { listener: "streamwizard.geo", event: contextGeo } },
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
