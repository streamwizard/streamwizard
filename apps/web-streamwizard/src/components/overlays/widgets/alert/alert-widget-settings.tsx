"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  ColorPicker,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Slider,
  Switch,
} from "@repo/ui";
import {
  ALERT_AMOUNT_LABELS,
  ALERT_EVENT_LABELS,
  ALERT_EVENT_TYPES,
  ALERT_TEST_BROWSER_EVENT,
  normalizeAlertWidgetConfig,
  type AlertAnimationIn,
  type AlertAnimationOut,
  type AlertEventType,
  type AlertLayout,
  type AlertTestBrowserEventDetail,
  type AlertVariantConfig,
  type AlertWidgetItemConfig,
} from "@repo/ui/overlay";
import {
  FontWeightSelect,
  GoogleFontSelect,
  TextAlignSelect,
} from "@/components/overlays/inspector-fields";
import { AssetPickerDialog } from "@/components/media/asset-picker-dialog";
import { sendTestAlertToOverlay } from "@/actions/overlay-test-alert";
import type { AssetKind } from "@/actions/assets";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";

const LAYOUT_LABELS: Record<AlertLayout, string> = {
  stacked: "Media above text",
  row: "Media beside text",
  overlay: "Text over media",
};

const ANIMATION_IN_LABELS: Record<AlertAnimationIn, string> = {
  fade: "Fade in",
  slide_up: "Slide up",
  slide_down: "Slide down",
  zoom: "Zoom in",
  bounce: "Bounce in",
};

const ANIMATION_OUT_LABELS: Record<AlertAnimationOut, string> = {
  fade: "Fade out",
  slide_down: "Slide down",
  zoom: "Zoom out",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
      {children}
    </h3>
  );
}

/** Small caps label used to split a panel into groups. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider pt-1">
      {children}
    </p>
  );
}

/** Media-library picker button showing the chosen file, with clear action. */
function MediaField({
  label,
  kinds,
  value,
  helper,
  onChange,
}: {
  label: string;
  kinds: AssetKind[];
  value: string;
  helper?: string;
  onChange: (url: string, kind: AssetKind | null) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileName = value ? decodeURIComponent(value.split("/").pop() ?? value) : null;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        {kinds.includes("image") && value && !value.endsWith(".webm") && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-8 w-8 rounded object-cover bg-muted shrink-0" />
        )}
        <Button
          size="sm"
          variant="outline"
          className="flex-1 min-w-0 justify-start text-xs font-normal"
          onClick={() => setPickerOpen(true)}
        >
          <span className="truncate">{fileName ?? "Choose from media library…"}</span>
        </Button>
        {value && (
          <Button
            size="sm"
            variant="ghost"
            className="text-xs shrink-0"
            onClick={() => onChange("", null)}
          >
            Clear
          </Button>
        )}
      </div>
      {helper && (
        <p className="text-[11px] text-muted-foreground leading-snug">{helper}</p>
      )}
      <AssetPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        kindFilter={kinds}
        title={`Pick ${label.toLowerCase()}`}
        onSelect={(asset) => onChange(asset.url, asset.kind)}
      />
    </div>
  );
}

export function AlertWidgetSettings({ item, updateItem }: OverlayInspectorAppendProps) {
  const cfg = normalizeAlertWidgetConfig(item.config);
  const [openEvent, setOpenEvent] = useState<string>("follow");
  const [sendToStream, setSendToStream] = useState(false);
  const [testBusy, setTestBusy] = useState<AlertEventType | null>(null);

  function patchConfig(updates: Partial<AlertWidgetItemConfig>) {
    updateItem(item.id, { config: { ...cfg, ...updates } });
  }

  function patchVariant(event: AlertEventType, updates: Partial<AlertVariantConfig>) {
    patchConfig({
      variants: {
        ...cfg.variants,
        [event]: { ...cfg.variants[event], ...updates },
      },
    });
  }

  async function fireTest(event: AlertEventType) {
    // Local preview in the editor canvas — instant, no server needed.
    window.dispatchEvent(
      new CustomEvent<AlertTestBrowserEventDetail>(ALERT_TEST_BROWSER_EVENT, {
        detail: { sceneId: item.scene_id, event },
      })
    );
    if (!sendToStream) return;
    setTestBusy(event);
    const { ok, error } = await sendTestAlertToOverlay(event);
    setTestBusy(null);
    if (!ok) toast.error(error ?? "Could not send the test alert");
  }

  return (
    <div className="space-y-5">
      {/* ── Per-event config ─────────────────────────────────── */}
      <div>
        <SectionTitle>Alert types</SectionTitle>
        <Accordion
          type="single"
          collapsible
          value={openEvent}
          onValueChange={setOpenEvent}
          className="-mx-1"
        >
          {ALERT_EVENT_TYPES.map((event) => {
            const variant = cfg.variants[event];
            const amountLabel = ALERT_AMOUNT_LABELS[event];

            return (
              <AccordionItem key={event} value={event} className="border-b">
                {/* Trigger spans the row so the chevron sits far right; the
                    test button (left) and toggle (right) float over it. */}
                <div className="relative">
                  <AccordionTrigger className="w-full items-center gap-0 py-2 pl-16 pr-1 hover:no-underline">
                    <span className="flex flex-1 items-center gap-2 min-w-0 pr-16">
                      <span
                        className={
                          variant.enabled ? "truncate" : "truncate text-muted-foreground"
                        }
                      >
                        {ALERT_EVENT_LABELS[event]}
                      </span>
                      {!variant.enabled && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                          Off
                        </span>
                      )}
                    </span>
                  </AccordionTrigger>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-14 px-0 text-xs"
                    disabled={testBusy !== null}
                    onClick={() => void fireTest(event)}
                  >
                    {testBusy === event ? "…" : "Test"}
                  </Button>
                  <Switch
                    aria-label={`Enable ${ALERT_EVENT_LABELS[event]} alerts`}
                    className="absolute right-6 top-1/2 -translate-y-1/2"
                    checked={variant.enabled}
                    onCheckedChange={(v) => patchVariant(event, { enabled: v })}
                  />
                </div>

                <AccordionContent className="space-y-4 px-1 pb-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Title</Label>
                    <Input
                      value={variant.titleTemplate}
                      onChange={(e) =>
                        patchVariant(event, { titleTemplate: e.target.value })
                      }
                      className="h-9 text-sm"
                      maxLength={200}
                    />
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {"{name}"} is the viewer
                      {amountLabel ? `, {amount} is ${amountLabel}` : ""}.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Second line (optional)</Label>
                    <Input
                      value={variant.messageTemplate}
                      onChange={(e) =>
                        patchVariant(event, { messageTemplate: e.target.value })
                      }
                      className="h-9 text-sm"
                      maxLength={200}
                      placeholder="Leave empty to hide"
                    />
                    {(event === "cheer" || event === "resub") && (
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        {"{message}"} shows what the viewer wrote.
                      </p>
                    )}
                  </div>

                  <MediaField
                    label="Image or video"
                    kinds={["image", "video"]}
                    value={variant.mediaUrl}
                    helper="Transparent WebM and GIFs work great."
                    onChange={(url, kind) =>
                      patchVariant(event, {
                        mediaUrl: url,
                        mediaKind:
                          kind === "video" ? "video" : kind === "image" ? "image" : "",
                      })
                    }
                  />

                  <MediaField
                    label="Sound"
                    kinds={["audio"]}
                    value={variant.soundUrl}
                    onChange={(url) => patchVariant(event, { soundUrl: url })}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Volume ({Math.round(variant.volume * 100)}%)
                      </Label>
                      <Slider
                        value={[variant.volume]}
                        onValueChange={([v]) => patchVariant(event, { volume: v })}
                        min={0}
                        max={1}
                        step={0.05}
                        className="py-1"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        On screen ({variant.durationSeconds}s)
                      </Label>
                      <Slider
                        value={[variant.durationSeconds]}
                        onValueChange={([v]) =>
                          patchVariant(event, { durationSeconds: Math.round(v) })
                        }
                        min={1}
                        max={30}
                        step={1}
                        className="py-1"
                      />
                    </div>
                  </div>

                  {amountLabel && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Minimum {amountLabel}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={variant.minAmount}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (!Number.isFinite(n)) return;
                          patchVariant(event, { minAmount: Math.max(0, Math.round(n)) });
                        }}
                        className="h-9 text-sm"
                      />
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Alerts below this are skipped. 0 shows everything.
                      </p>
                    </div>
                  )}

                  <GroupLabel>Look &amp; feel</GroupLabel>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Layout</Label>
                    <Select
                      value={variant.layout}
                      onValueChange={(v) =>
                        patchVariant(event, { layout: v as AlertLayout })
                      }
                    >
                      <SelectTrigger className="h-9 text-sm w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(LAYOUT_LABELS) as AlertLayout[]).map((l) => (
                          <SelectItem key={l} value={l} className="text-sm">
                            {LAYOUT_LABELS[l]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Entrance</Label>
                      <Select
                        value={variant.animationIn}
                        onValueChange={(v) =>
                          patchVariant(event, { animationIn: v as AlertAnimationIn })
                        }
                      >
                        <SelectTrigger className="h-9 text-sm w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ANIMATION_IN_LABELS) as AlertAnimationIn[]).map(
                            (a) => (
                              <SelectItem key={a} value={a} className="text-sm">
                                {ANIMATION_IN_LABELS[a]}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Exit</Label>
                      <Select
                        value={variant.animationOut}
                        onValueChange={(v) =>
                          patchVariant(event, { animationOut: v as AlertAnimationOut })
                        }
                      >
                        <SelectTrigger className="h-9 text-sm w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ANIMATION_OUT_LABELS) as AlertAnimationOut[]).map(
                            (a) => (
                              <SelectItem key={a} value={a} className="text-sm">
                                {ANIMATION_OUT_LABELS[a]}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <GoogleFontSelect
                    id={`alert-font-family-${event}`}
                    value={variant.fontFamily}
                    onValueChange={(v) => patchVariant(event, { fontFamily: v })}
                  />

                  <div className="space-y-1.5">
                    <Label className="text-xs">Font size ({variant.fontSize}px)</Label>
                    <Slider
                      value={[variant.fontSize]}
                      onValueChange={([v]) =>
                        patchVariant(event, { fontSize: Math.round(v) })
                      }
                      min={12}
                      max={96}
                      step={1}
                      className="py-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <FontWeightSelect
                      id={`alert-font-weight-${event}`}
                      className="min-w-0"
                      triggerClassName="w-full"
                      value={variant.fontWeight}
                      onValueChange={(v) => patchVariant(event, { fontWeight: v })}
                    />
                    <TextAlignSelect
                      id={`alert-align-${event}`}
                      className="min-w-0"
                      triggerClassName="w-full"
                      value={variant.align}
                      onValueChange={(v) => patchVariant(event, { align: v })}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Title</Label>
                      <ColorPicker
                        value={variant.titleColor}
                        onChange={(titleColor) => patchVariant(event, { titleColor })}
                        aria-label="Title color"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Accent</Label>
                      <ColorPicker
                        value={variant.accentColor}
                        fallback="#9e7aff"
                        onChange={(accentColor) => patchVariant(event, { accentColor })}
                        aria-label="Accent color"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Message</Label>
                      <ColorPicker
                        value={variant.messageColor}
                        fallback="#d4d4d8"
                        onChange={(messageColor) => patchVariant(event, { messageColor })}
                        aria-label="Message color"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Accent highlights {"{name}"} and {"{amount}"} in the title.
                  </p>

                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor={`alert-text-shadow-${event}`}
                      className="text-xs cursor-pointer"
                    >
                      Text shadow for readability
                    </Label>
                    <Switch
                      id={`alert-text-shadow-${event}`}
                      checked={variant.textShadow}
                      onCheckedChange={(v) => patchVariant(event, { textShadow: v })}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      <Separator />

      {/* ── Everything-alerts settings ───────────────────────── */}
      <div>
        <SectionTitle>All alerts</SectionTitle>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Master volume ({Math.round(cfg.masterVolume * 100)}%)
            </Label>
            <Slider
              value={[cfg.masterVolume]}
              onValueChange={([v]) => patchConfig({ masterVolume: v })}
              min={0}
              max={1}
              step={0.05}
              className="py-1"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Gap between alerts ({cfg.gapSeconds}s)</Label>
            <Slider
              value={[cfg.gapSeconds]}
              onValueChange={([v]) => patchConfig({ gapSeconds: Math.round(v) })}
              min={0}
              max={10}
              step={1}
              className="py-1"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <Label htmlFor="alert-test-live" className="text-xs cursor-pointer">
                Also send tests to your live overlay
              </Label>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Fires the alert in OBS too, exactly like the real thing.
              </p>
            </div>
            <Switch
              id="alert-test-live"
              checked={sendToStream}
              onCheckedChange={setSendToStream}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
