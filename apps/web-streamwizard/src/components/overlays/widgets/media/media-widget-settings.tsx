"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  InspectorSection,
  MediaCardField,
  SegmentedField,
  SliderField,
  SwitchField,
  presetGeometry,
  type SegmentedOption,
} from "@/components/overlays/inspector-fields";
import {
  MEDIA_WIDGET_LIMITS,
  getDesignSize,
  normalizeVideoWidgetConfig,
  type MediaWidgetFit,
  type VideoWidgetItemConfig,
} from "@repo/ui/overlay";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";
import { readMediaSize } from "./read-media-size";

const FIT_OPTIONS: readonly SegmentedOption<MediaWidgetFit>[] = [
  { value: "contain", label: "Fit" },
  { value: "cover", label: "Fill" },
  { value: "fill", label: "Stretch" },
];

/** Settings for both the image and the video widget; a video adds playback. */
export function MediaWidgetSettings({ item, updateItem }: OverlayInspectorAppendProps) {
  const isVideo = item.type === "video_widget";
  // The video config is the image config plus playback, so one read covers both.
  const cfg = useMemo(() => normalizeVideoWidgetConfig(item.config), [item.config]);
  const what = isVideo ? "video" : "image";

  const itemRef = useRef(item);
  useEffect(() => {
    itemRef.current = item;
  }, [item]);

  function patchConfig(updates: Partial<VideoWidgetItemConfig>) {
    const next = { ...cfg, ...updates };
    updateItem(item.id, {
      config: isVideo ? next : { url: next.url, fit: next.fit, rounding: next.rounding },
    });
  }

  function pickFile(url: string) {
    patchConfig({ url });
    if (!url) return;
    // Reshape the box to the file, so a new picture never sits letterboxed in
    // the last one's frame. Width stays; the height follows the file.
    void readMediaSize(url, isVideo).then((size) => {
      const current = itemRef.current;
      if (!size || normalizeVideoWidgetConfig(current.config).url !== url) return;
      const design = getDesignSize(current);
      const geometry = presetGeometry(current, {
        w: design.w,
        h: Math.max(1, Math.round((design.w * size.h) / size.w)),
      });
      if (geometry) updateItem(current.id, geometry);
    });
  }

  return (
    <div className="space-y-6">
      <InspectorSection title={isVideo ? "Video" : "Image"} defaultOpen>
        <div className="space-y-4">
          <MediaCardField
            label={isVideo ? "Video" : "Image"}
            kinds={[what]}
            value={cfg.url}
            mediaKind={what}
            emptyTitle={isVideo ? "Add a video" : "Add an image"}
            emptyHint={
              isVideo
                ? "MP4 or WebM. A WebM with transparency keeps it on stream."
                : "PNG, JPG, WebP or GIF. A transparent PNG stays transparent."
            }
            onChange={(url) => pickFile(url)}
          />
          <SegmentedField
            id="media-widget-fit"
            label="Sizing"
            hint={`Fit shows the whole ${what}. Fill covers the box and trims what sticks out. Stretch ignores the ${what}'s shape.`}
            value={cfg.fit}
            options={FIT_OPTIONS}
            onChange={(fit) => patchConfig({ fit })}
          />
          <SliderField
            id="media-widget-rounding"
            label="Rounded corners"
            unit="%"
            hint="100% on a square box makes a circle. Works best with Fill."
            value={cfg.rounding}
            min={MEDIA_WIDGET_LIMITS.rounding.min}
            max={MEDIA_WIDGET_LIMITS.rounding.max}
            onChange={(rounding) => patchConfig({ rounding })}
          />
        </div>
      </InspectorSection>

      {isVideo ? (
        <InspectorSection title="Playback" defaultOpen>
          <div className="space-y-4">
            <SwitchField
              id="media-widget-loop"
              label="Loop"
              hint="Off plays the video once when the overlay loads and holds the last frame."
              checked={cfg.loop}
              onCheckedChange={(loop) => patchConfig({ loop })}
            />
            <SliderField
              id="media-widget-volume"
              label="Volume"
              unit="%"
              hint="0% is muted. The editor always stays quiet; you hear the sound in OBS."
              value={Math.round(cfg.volume * 100)}
              min={0}
              max={100}
              onChange={(volume) => patchConfig({ volume: volume / 100 })}
            />
          </div>
        </InspectorSection>
      ) : null}
    </div>
  );
}
