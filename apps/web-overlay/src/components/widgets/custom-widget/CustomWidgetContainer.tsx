"use client";

import { useEffect, useState } from "react";
import type { OverlayWidgetProps } from "@repo/ui/overlay";
import { CustomWidgetIframe, buildWidgetSrcdoc, mergeFieldValues } from "@repo/ui/overlay";
import { loadCustomWidgetData } from "@/actions/custom-widget";

interface CustomWidgetConfig {
  widget_id: string;
  instance_id: string;
}

export function CustomWidgetContainer({ scene, item }: OverlayWidgetProps) {
  const cfg = item.config as unknown as CustomWidgetConfig;
  const [srcdoc, setSrcdoc] = useState("");
  const [fieldData, setFieldData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!cfg.widget_id) return;

    let cancelled = false;

    loadCustomWidgetData(cfg.widget_id, scene.user_id, cfg.instance_id || undefined).then(
      ({ data }) => {
        if (cancelled || !data) return;
        setFieldData(mergeFieldValues(data.fields, data.field_values));
        setSrcdoc(buildWidgetSrcdoc(data.html, data.js, data.extra_css, data.fields, data.field_values));
      }
    );

    return () => { cancelled = true; };
  }, [cfg.widget_id, cfg.instance_id, scene.user_id]);

  if (!srcdoc) return null;

  return (
    <CustomWidgetIframe
      srcdoc={srcdoc}
      fieldData={fieldData}
      userId={scene.user_id}
      subscriberToken={scene.subscriber_token}
      style={{ width: "100%", height: "100%" }}
      title="custom-widget"
    />
  );
}
