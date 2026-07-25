"use client";

import { useState } from "react";
import type { WidgetFieldDef } from "@repo/ui/overlay";
import { isAssetFieldType } from "@repo/ui/overlay";
import { AssetPickerDialog } from "@/components/media/asset-picker-dialog";
import type { AssetKind } from "@/actions/assets";
import { GoogleFontSelect } from "@/components/overlays/inspector-fields";
import { Button, Input, Label, Slider, Switch } from "@repo/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";

/**
 * Renders one widget field from its schema definition. Shared by the overlay
 * inspector (editing a placed widget's saved values) and the widget editor's
 * preview panel (trying values out against unsaved code) so the two can never
 * disagree about how a field type is presented.
 */
export function WidgetFieldInput({
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

  if (isAssetFieldType(def.type)) {
    return (
      <AssetField
        fieldKey={fieldKey}
        label={label}
        kind={def.type as AssetKind}
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
      />
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

function AssetField({
  fieldKey,
  label,
  kind,
  value,
  onChange,
}: {
  fieldKey: string;
  label: string;
  kind: AssetKind;
  value: string;
  onChange: (v: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileName = value ? decodeURIComponent(value.split("/").pop() ?? value) : null;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        {kind === "image" && value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="h-8 w-8 rounded object-cover bg-muted shrink-0" />
        )}
        <Button
          size="sm"
          variant="outline"
          className="flex-1 min-w-0 justify-start text-xs font-normal"
          onClick={() => setPickerOpen(true)}
        >
          <span className="truncate">{fileName ?? `Choose ${kind}…`}</span>
        </Button>
        {value && (
          <Button size="sm" variant="ghost" className="text-xs shrink-0" onClick={() => onChange("")}>
            Clear
          </Button>
        )}
      </div>
      <AssetPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        kindFilter={[kind]}
        title={`Pick ${kind === "audio" ? "a sound" : `an ${kind}`} for ${label}`}
        onSelect={(asset) => onChange(asset.url)}
        key={`picker-${fieldKey}`}
      />
    </div>
  );
}
