"use client";

import { useEffect, useRef, useState } from "react";
import type { OverlayWidgetProps } from "@repo/ui/overlay";
import { buildWidgetSrcdoc, mergeFieldValues } from "@repo/ui/overlay";
import { loadCustomWidgetData } from "@/actions/custom-widget";
import type { CustomWidgetData } from "@/actions/custom-widget";

interface CustomWidgetConfig {
  widget_id: string;
  instance_id: string;
}

export function CustomWidgetContainer({ scene, item }: OverlayWidgetProps) {
  const cfg = item.config as unknown as CustomWidgetConfig;
  const [srcdoc, setSrcdoc] = useState<string>("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!cfg.widget_id) return;

    let cancelled = false;

    loadCustomWidgetData(cfg.widget_id, scene.user_id, cfg.instance_id || undefined).then(
      ({ data }) => {
        if (cancelled || !data) return;
        const doc = buildWidgetSrcdoc(
          data.html,
          data.js,
          data.extra_css,
          data.fields,
          data.field_values
        );

        const fieldData = mergeFieldValues(data.fields, data.field_values);

        const fireLoad = () => {
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: "onWidgetLoad",
              payload: {
                fieldData,
                channel: { user_id: scene.user_id },
                session: {},
              },
            },
            "*"
          );
        };

        setSrcdoc(doc);

        // Fire onWidgetLoad after the iframe has fully loaded the srcdoc
        const iframe = iframeRef.current;
        if (iframe) {
          iframe.addEventListener("load", fireLoad, { once: true });
        }
      }
    );

    return () => { cancelled = true; };
  }, [cfg.widget_id, cfg.instance_id, scene.user_id]);

  if (!srcdoc) return null;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcdoc}
      sandbox="allow-scripts"
      style={{ width: "100%", height: "100%", border: "none", background: "transparent", colorScheme: "normal" }}
      title="custom-widget"
    />
  );
}
