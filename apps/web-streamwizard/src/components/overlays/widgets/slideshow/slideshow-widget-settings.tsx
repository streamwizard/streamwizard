"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ImagePlus, X } from "lucide-react";
import { Button } from "@repo/ui";
import { AssetPickerDialog } from "@/components/media/asset-picker-dialog";
import {
  InspectorReveal,
  InspectorSection,
  SegmentedField,
  SliderField,
  SwitchField,
  presetGeometry,
  type SegmentedOption,
} from "@/components/overlays/inspector-fields";
import {
  SLIDESHOW_WIDGET_LIMITS,
  getDesignSize,
  normalizeSlideshowWidgetConfig,
  type MediaWidgetFit,
  type SlideshowWidgetItemConfig,
  type SlideshowWidgetTransition,
} from "@repo/ui/overlay";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";
import { readMediaSize } from "../media/read-media-size";

const TRANSITION_OPTIONS: readonly SegmentedOption<SlideshowWidgetTransition>[] = [
  { value: "fade", label: "Fade" },
  { value: "slide", label: "Slide" },
  { value: "none", label: "Cut" },
];

const FIT_OPTIONS: readonly SegmentedOption<MediaWidgetFit>[] = [
  { value: "contain", label: "Fit" },
  { value: "cover", label: "Fill" },
  { value: "fill", label: "Stretch" },
];

function fileName(url: string): string {
  return decodeURIComponent(url.split("/").pop() ?? url);
}

export function SlideshowWidgetSettings({ item, updateItem }: OverlayInspectorAppendProps) {
  const cfg = useMemo(() => normalizeSlideshowWidgetConfig(item.config), [item.config]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const full = cfg.images.length >= SLIDESHOW_WIDGET_LIMITS.images;

  const itemRef = useRef(item);
  useEffect(() => {
    itemRef.current = item;
  }, [item]);

  function patchConfig(updates: Partial<SlideshowWidgetItemConfig>) {
    updateItem(item.id, { config: { ...cfg, ...updates } });
  }

  function addImage(url: string) {
    const first = cfg.images.length === 0;
    patchConfig({ images: [...cfg.images, url] });
    if (!first) return;
    // The first picture sets the shape of the box, so it is not letterboxed in
    // the default frame. Later ones fit into whatever shape that left.
    void readMediaSize(url, false).then((size) => {
      const current = itemRef.current;
      if (!size || normalizeSlideshowWidgetConfig(current.config).images[0] !== url) return;
      const design = getDesignSize(current);
      const geometry = presetGeometry(current, {
        w: design.w,
        h: Math.max(1, Math.round((design.w * size.h) / size.w)),
      });
      if (geometry) updateItem(current.id, geometry);
    });
  }

  function moveImage(from: number, to: number) {
    const images = [...cfg.images];
    const [moved] = images.splice(from, 1);
    if (moved === undefined) return;
    images.splice(to, 0, moved);
    patchConfig({ images });
  }

  return (
    <div className="space-y-6">
      <InspectorSection title="Images" defaultOpen>
        <div className="space-y-3">
          {cfg.images.length > 0 ? (
            <ol className="space-y-1.5">
              {cfg.images.map((url, index) => {
                const name = fileName(url);
                return (
                  // The same file can be in the list twice, so the URL alone is not a key.
                  <li key={`${index}-${url}`} className="flex items-center gap-2 rounded-lg border bg-card p-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="size-9 shrink-0 rounded bg-muted object-cover" />
                    <span className="min-w-0 flex-1 truncate text-xs" title={name}>
                      {name}
                    </span>
                    <div className="flex shrink-0 items-center">
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Move ${name} up`}
                        disabled={index === 0}
                        onClick={() => moveImage(index, index - 1)}
                      >
                        <ChevronUp />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Move ${name} down`}
                        disabled={index === cfg.images.length - 1}
                        onClick={() => moveImage(index, index + 1)}
                      >
                        <ChevronDown />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="text-muted-foreground"
                        aria-label={`Remove ${name}`}
                        onClick={() => patchConfig({ images: cfg.images.filter((_, i) => i !== index) })}
                      >
                        <X />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : null}

          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs"
            disabled={full}
            onClick={() => setPickerOpen(true)}
          >
            <ImagePlus />
            {cfg.images.length === 0 ? "Add your first image" : "Add another image"}
          </Button>
          <p className="text-xs leading-snug text-muted-foreground">
            {full
              ? `That's the limit of ${SLIDESHOW_WIDGET_LIMITS.images} images. Remove one to add another.`
              : cfg.images.length === 1
                ? "One image just sits there. Add a second and they start taking turns."
                : "Shown top to bottom. Use the arrows to change the order."}
          </p>

          <AssetPickerDialog
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            kindFilter={["image"]}
            title="Pick an image"
            onSelect={(asset) => addImage(asset.url)}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Playback" defaultOpen>
        <div className="space-y-4">
          <SliderField
            id="slideshow-widget-interval"
            label="Time per image"
            unit="s"
            value={cfg.intervalSeconds}
            min={SLIDESHOW_WIDGET_LIMITS.intervalSeconds.min}
            max={SLIDESHOW_WIDGET_LIMITS.intervalSeconds.max}
            onChange={(intervalSeconds) => patchConfig({ intervalSeconds })}
          />
          <SegmentedField
            id="slideshow-widget-transition"
            label="Transition"
            value={cfg.transition}
            options={TRANSITION_OPTIONS}
            onChange={(transition) => patchConfig({ transition })}
          />
          <InspectorReveal show={cfg.images.length > 2} marginTop={0}>
            <SwitchField
              id="slideshow-widget-shuffle"
              label="Shuffle"
              hint="A random image each time instead of the list order. Never the same one twice in a row."
              checked={cfg.shuffle}
              onCheckedChange={(shuffle) => patchConfig({ shuffle })}
            />
          </InspectorReveal>
        </div>
      </InspectorSection>

      <InspectorSection title="Look">
        <div className="space-y-4">
          <SegmentedField
            id="slideshow-widget-fit"
            label="Sizing"
            hint="Fit shows each whole image. Fill covers the box and trims what sticks out. Stretch ignores the image's shape."
            value={cfg.fit}
            options={FIT_OPTIONS}
            onChange={(fit) => patchConfig({ fit })}
          />
          <SliderField
            id="slideshow-widget-rounding"
            label="Rounded corners"
            unit="%"
            hint="100% on a square box makes a circle. Works best with Fill."
            value={cfg.rounding}
            min={SLIDESHOW_WIDGET_LIMITS.rounding.min}
            max={SLIDESHOW_WIDGET_LIMITS.rounding.max}
            onChange={(rounding) => patchConfig({ rounding })}
          />
        </div>
      </InspectorSection>
    </div>
  );
}
