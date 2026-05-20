"use client";

import { memo, useEffect, useState } from "react";
import { asCustomWidgetConfig } from "@/types/overlays";
import type { CustomWidgetItemConfig } from "@/types/overlays";
import type { OverlayCanvasProps } from "../../registry/overlay-widget-registry.types";
import { getWidget, getOrCreateWidgetInstance } from "@/actions/widgets";
import { CustomWidgetIframe, buildWidgetSrcdoc, mergeFieldValues } from "@repo/ui/overlay";

function CustomWidgetCanvasInner({ item, scene }: OverlayCanvasProps) {
  const cfg = asCustomWidgetConfig(item.config);
  const [srcdoc, setSrcdoc] = useState<string | null>(null);
  const [fieldData, setFieldData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!cfg.widget_id) return;

    async function load() {
      const { data: widget } = await getWidget(cfg.widget_id);
      if (!widget) return;

      let fieldValues: Record<string, unknown> = {};
      if (cfg.instance_id || (item.id && !item.id.startsWith("temp-"))) {
        const { data: instance } = await getOrCreateWidgetInstance(item.id, cfg.widget_id);
        if (instance) fieldValues = instance.field_values ?? {};
      }

      const merged = mergeFieldValues(widget.fields, fieldValues);
      setFieldData(merged);
      setSrcdoc(buildWidgetSrcdoc(widget.html, widget.js, widget.extra_css, widget.fields, fieldValues));
    }

    load();
  }, [cfg.widget_id, cfg.instance_id, item.id]);

  if (!cfg.widget_id) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-indigo-500/10">
        <p className="text-xs text-white/50 px-2 text-center">
          No widget selected — pick one in the inspector
        </p>
      </div>
    );
  }

  if (!srcdoc) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-indigo-500/10">
        <p className="text-xs text-white/40">Loading…</p>
      </div>
    );
  }

  return (
    <CustomWidgetIframe
      srcdoc={srcdoc}
      fieldData={fieldData}
      subscriberToken={scene.subscriber_token}
      className="w-full h-full"
      style={{ pointerEvents: "none" }}
      title="custom widget preview"
    />
  );
}

export const CustomWidgetCanvas = memo(
  CustomWidgetCanvasInner,
  (prev, next) => {
    const prevCfg = prev.item.config as CustomWidgetItemConfig;
    const nextCfg = next.item.config as CustomWidgetItemConfig;
    return (
      prev.item.id === next.item.id &&
      prevCfg.widget_id === nextCfg.widget_id &&
      prevCfg.instance_id === nextCfg.instance_id
    );
  }
);
