"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { asCustomWidgetConfig } from "@/types/overlays";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";
import { getWidgets, getWidget, getOrCreateWidgetInstance, updateWidgetInstanceFieldValues } from "@/actions/widgets";
import type { Widget, OverlayWidgetInstance } from "@/actions/widgets";
import { Button } from "@repo/ui";
import { WidgetFieldInput } from "./widget-field-input";

export function CustomWidgetSettings({
  item,
  updateItem,
}: OverlayInspectorAppendProps) {
  const cfg = asCustomWidgetConfig(item.config);
  const [widget, setWidget] = useState<Widget | null>(null);
  const [instance, setInstance] = useState<OverlayWidgetInstance | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!cfg.widget_id) return;
    getWidget(cfg.widget_id).then(({ data }) => {
      if (data) setWidget(data);
    });
  }, [cfg.widget_id]);

  useEffect(() => {
    if (!cfg.widget_id || !item.id || item.id.startsWith("temp-")) return;
    getOrCreateWidgetInstance(item.id, cfg.widget_id).then(({ data }) => {
      if (data) {
        setInstance(data);
        setFieldValues(data.field_values ?? {});
        // Sync instance_id into config if not set
        if (!cfg.instance_id) {
          updateItem(item.id, { config: { ...cfg, instance_id: data.id } });
        }
      }
    });
  }, [cfg.widget_id, item.id]);

  function patchFieldValue(key: string, value: unknown) {
    const next = { ...fieldValues, [key]: value };
    setFieldValues(next);
    if (!instance) return;
    startTransition(async () => {
      await updateWidgetInstanceFieldValues(instance.id, next);
    });
  }

  if (!cfg.widget_id) {
    return (
      <WidgetPicker
        onSelect={(widgetId) =>
          updateItem(item.id, { config: { ...cfg, widget_id: widgetId, instance_id: "" } })
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate max-w-[120px]">
          {widget?.name ?? "Custom Widget"}
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          <Button asChild size="sm" variant="ghost">
            <Link href={`/dashboard/widgets/${cfg.widget_id}`} target="_blank">
              Edit code
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              updateItem(item.id, { config: { ...cfg, widget_id: "", instance_id: "" } })
            }
          >
            Change
          </Button>
        </div>
      </div>

      {widget && Object.keys(widget.fields).length > 0 && (
        <div className="space-y-3">
          {Object.entries(widget.fields).map(([key, def]) => (
            <WidgetFieldInput
              key={key}
              fieldKey={key}
              def={def}
              value={key in fieldValues ? fieldValues[key] : def.value}
              onChange={(v) => patchFieldValue(key, v)}
            />
          ))}
        </div>
      )}

      {widget && Object.keys(widget.fields).length === 0 && (
        <p className="text-xs text-muted-foreground">
          This widget has no configurable fields.
        </p>
      )}
    </div>
  );
}

function WidgetPicker({ onSelect }: { onSelect: (widgetId: string) => void }) {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWidgets().then(({ data }) => {
      setWidgets(data ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading widgets…</p>;
  }

  if (widgets.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          You don't have any custom widgets yet.
        </p>
        <Button asChild size="sm" variant="outline" className="w-full">
          <Link href="/dashboard/widgets/new" target="_blank">
            Create a widget
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Pick a widget to use on the canvas:
      </p>
      {widgets.map((w) => (
        <button
          key={w.id}
          type="button"
          onClick={() => onSelect(w.id)}
          className="w-full text-left px-3 py-2 rounded-md border border-border hover:bg-accent hover:border-primary transition-colors"
        >
          <div className="text-sm font-medium truncate">{w.name}</div>
          {w.description && (
            <div className="text-xs text-muted-foreground truncate mt-0.5">
              {w.description}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
