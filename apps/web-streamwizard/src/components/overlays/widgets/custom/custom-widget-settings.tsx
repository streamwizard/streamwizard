"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { asCustomWidgetConfig } from "@/types/overlays";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";
import { getWidgets, getWidget, getOrCreateWidgetInstance, updateWidgetInstanceFieldValues } from "@/actions/widgets";
import type { Widget, OverlayWidgetInstance } from "@/actions/widgets";
import type { WidgetFieldDef, WidgetFieldSchema } from "@repo/ui/overlay";
import { GoogleFontSelect } from "@/components/overlays/inspector-fields";
import { Label } from "@repo/ui";
import { Input } from "@repo/ui";
import { Slider } from "@repo/ui";
import { Switch } from "@repo/ui";
import { Button } from "@repo/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";

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
            <FieldInput
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

function FieldInput({
  fieldKey,
  def,
  value,
  onChange,
}: {
  fieldKey: string;
  def: WidgetFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (def.type === "hidden") return null;

  const label = def.label ?? fieldKey;

  if (def.type === "text") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{label}</Label>
        <Input
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm"
        />
      </div>
    );
  }

  if (def.type === "number") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{label}</Label>
        <Input
          type="number"
          value={String(value ?? "")}
          onChange={(e) => onChange(Number(e.target.value))}
          className="text-sm"
        />
      </div>
    );
  }

  if (def.type === "checkbox") {
    return (
      <div className="flex items-center gap-2">
        <Switch
          checked={Boolean(value)}
          onCheckedChange={onChange}
          id={`field-${fieldKey}`}
        />
        <Label htmlFor={`field-${fieldKey}`} className="text-xs">{label}</Label>
      </div>
    );
  }

  if (def.type === "colorpicker") {
    const hex = typeof value === "string" && value.startsWith("#") ? value : "#ffffff";
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{label}</Label>
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background cursor-pointer"
        />
      </div>
    );
  }

  if (def.type === "slider") {
    const num = typeof value === "number" ? value : Number(def.value ?? 0);
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{label} ({num})</Label>
        <Slider
          value={[num]}
          onValueChange={([v]) => onChange(v)}
          min={def.min ?? 0}
          max={def.max ?? 100}
          step={def.step ?? 1}
          className="py-1"
        />
      </div>
    );
  }

  if (def.type === "dropdown" && def.options) {
    // options can be an array [{value, label}] or a plain object {value: label}
    const options = Array.isArray(def.options)
      ? def.options
      : Object.entries(def.options as Record<string, string>).map(
          ([value, label]) => ({ value, label })
        );
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{label}</Label>
        <Select value={String(value ?? "")} onValueChange={onChange}>
          <SelectTrigger className="text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (def.type === "googleFont") {
    return (
      <GoogleFontSelect
        id={`field-${fieldKey}`}
        value={String(value ?? "")}
        onValueChange={onChange}
      />
    );
  }

  return null;
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
