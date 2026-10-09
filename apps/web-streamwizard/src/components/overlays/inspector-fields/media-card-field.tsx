"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Music, Play, Square } from "lucide-react";
import { Button, Label } from "@repo/ui";
import { AssetPickerDialog } from "@/components/media/asset-picker-dialog";
import type { AssetKind } from "@/lib/asset-mime";

export interface MediaCardFieldProps {
  label: string;
  kinds: AssetKind[];
  /** CDN URL of the chosen file. Empty = nothing chosen. */
  value: string;
  /** What `value` is, when the caller already knows. Falls back to the extension. */
  mediaKind?: "image" | "video" | "";
  /** The empty card's call to action, e.g. "Add an image or video". */
  emptyTitle: string;
  /** One line under it: what works well here. */
  emptyHint?: string;
  /** 0–1. How loud the sound preview plays; the video preview is always muted. */
  previewVolume?: number;
  onChange: (url: string, kind: AssetKind | null) => void;
}

const VIDEO_EXTENSION = /\.(webm|mp4|mov|m4v)(\?|$)/i;

/**
 * A media slot you cannot miss: a wide empty card that says what goes in it,
 * and once filled, the file itself -- the picture, the video on hover, or a
 * sound you can play -- with Replace and Remove beside its name.
 *
 * `MediaField` is the one-line version, for a slot that is a detail of the
 * widget. This is for a slot that is the point of it.
 */
export function MediaCardField({
  label,
  kinds,
  value,
  mediaKind,
  emptyTitle,
  emptyHint,
  previewVolume = 1,
  onChange,
}: MediaCardFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileName = value ? decodeURIComponent(value.split("/").pop() ?? value) : "";
  const isSound = kinds.length === 1 && kinds[0] === "audio";
  const isVideo = mediaKind ? mediaKind === "video" : VIDEO_EXTENSION.test(value);
  const what = label.toLowerCase();

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>

      {!value ? (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex w-full items-center gap-3 rounded-lg border border-dashed border-input px-3 py-3.5 text-left transition-colors hover:border-foreground/40 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            {isSound ? <Music className="size-5" /> : <ImagePlus className="size-5" />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">{emptyTitle}</span>
            {emptyHint ? (
              <span className="block text-xs leading-snug text-muted-foreground">{emptyHint}</span>
            ) : null}
          </span>
        </button>
      ) : isSound ? (
        // Name over actions, not beside them: on one line the buttons left
        // the file name a third of the card.
        <div className="flex items-center gap-3 rounded-lg border bg-card p-2">
          <SoundPreviewButton url={value} volume={previewVolume} />
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm" title={fileName}>
              {fileName}
            </span>
            <div className="-ml-2">
              <FileActions what={what} onReplace={() => setPickerOpen(true)} onRemove={() => onChange("", null)} />
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <VisualPreview
            url={value}
            isVideo={isVideo}
            label={`Replace the ${what}`}
            onClick={() => setPickerOpen(true)}
          />
          <div className="flex items-center gap-2 border-t py-1 pl-3 pr-1">
            <span className="min-w-0 flex-1 truncate text-xs" title={fileName}>
              {fileName}
            </span>
            <FileActions what={what} onReplace={() => setPickerOpen(true)} onRemove={() => onChange("", null)} />
          </div>
        </div>
      )}

      <AssetPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        kindFilter={kinds}
        title={`Pick ${what}`}
        onSelect={(asset) => onChange(asset.url, asset.kind)}
      />
    </div>
  );
}

function FileActions({
  what,
  onReplace,
  onRemove,
}: {
  what: string;
  onReplace: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center">
      <Button size="xs" variant="ghost" aria-label={`Replace the ${what}`} onClick={onReplace}>
        Replace
      </Button>
      <Button
        size="xs"
        variant="ghost"
        className="text-muted-foreground"
        aria-label={`Remove the ${what}`}
        onClick={onRemove}
      >
        Remove
      </Button>
    </div>
  );
}

/** The picture, or the video's first frame; a video plays while it is hovered. */
function VisualPreview({
  url,
  isVideo,
  label,
  onClick,
}: {
  url: string;
  isVideo: boolean;
  label: string;
  onClick: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => void videoRef.current?.play().catch(() => {})}
      onMouseLeave={() => videoRef.current?.pause()}
      className="block h-32 w-full bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      {isVideo ? (
        <video
          ref={videoRef}
          key={url}
          src={url}
          muted
          loop
          playsInline
          preload="metadata"
          className="size-full object-contain"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-contain" />
      )}
    </button>
  );
}

/** Plays the chosen sound once, so a file name is never the only clue. */
function SoundPreviewButton({ url, volume }: { url: string; volume: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const stop = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(false);
  };

  // A different file, or the field going away, ends whatever was playing.
  useEffect(() => stop, [url]);

  const toggle = () => {
    if (playing) return stop();
    const audio = new Audio(url);
    audio.volume = Math.min(1, Math.max(0, volume));
    audio.onended = stop;
    audioRef.current = audio;
    setPlaying(true);
    audio.play().catch(stop);
  };

  return (
    <Button
      size="icon"
      variant="outline"
      className="size-10 shrink-0"
      aria-label={playing ? "Stop the preview" : "Play the sound"}
      onClick={toggle}
    >
      {playing ? <Square className="size-4" /> : <Play className="size-4" />}
    </Button>
  );
}
