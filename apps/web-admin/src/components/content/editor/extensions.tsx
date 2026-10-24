"use client";

import { useId, useRef, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { TableKit } from "@tiptap/extension-table";
import { AlignCenter, AlignLeft, AlignRight, Film, Info, Lightbulb, Trash2, TriangleAlert, X } from "lucide-react";
import {
  CALLOUT_VARIANTS,
  MAX_HEADING_LEVEL,
  MAX_IMAGE_SIZE,
  MIN_HEADING_LEVEL,
  MIN_IMAGE_SIZE,
  sanitizeHref,
  type CalloutVariant,
  type ImageAlign,
} from "@repo/cms";
import { Button, Checkbox, Label, Popover, PopoverContent, PopoverTrigger, Textarea } from "@repo/ui";
import { cn } from "@/lib/utils";
import { HeadingAnchor } from "./heading-anchor";

// The editor's schema. It mirrors @repo/cms sanitizeDoc's allowlist: nothing
// the public renderer can't draw can be typed or pasted in. Pasted <img> tags
// are dropped on purpose; images only come from the media library.

const ALLOWED_LEVELS = Array.from(
  { length: MAX_HEADING_LEVEL - MIN_HEADING_LEVEL + 1 },
  (_, i) => MIN_HEADING_LEVEL + i,
) as (2 | 3 | 4)[];

const SIZE_PRESETS = [
  { label: "S", size: 33, name: "Small" },
  { label: "M", size: 50, name: "Medium" },
  { label: "L", size: 75, name: "Large" },
  { label: "Full", size: 100, name: "Full width" },
] as const;
const SIZE_STEP = 5;
const ALIGNMENTS = [
  { value: "left", name: "Align left", icon: AlignLeft },
  { value: "center", name: "Centre", icon: AlignCenter },
  { value: "right", name: "Align right", icon: AlignRight },
] as const;

/** A stored size, or full width when there's none. */
function sizeOf(attrs: Record<string, unknown>): number {
  const size = attrs.size;
  return typeof size === "number" && size >= MIN_IMAGE_SIZE && size < MAX_IMAGE_SIZE ? size : MAX_IMAGE_SIZE;
}

// The image as it will read on the page, nothing else in the way. Its alt
// text was written when it was uploaded; it can still be changed from the
// small bar that shows while the image is selected, next to the size presets,
// the caption and remove. Dragging either side handle resizes it.
function ImageView({ node, updateAttributes, deleteNode, selected }: ReactNodeViewProps) {
  const uid = useId();
  const { src, alt, decorative, caption } = node.attrs as {
    src: string | null;
    alt: string;
    decorative: boolean;
    caption: string | null;
  };
  const stored = sizeOf(node.attrs);
  const align = (node.attrs.align as ImageAlign | null) ?? "center";
  const [dragSize, setDragSize] = useState<number | null>(null);
  const [captionOpen, setCaptionOpen] = useState(false);
  const figure = useRef<HTMLElement>(null);
  const size = dragSize ?? stored;
  const missingAlt = !decorative && !alt.trim();
  const showCaption = captionOpen || Boolean(caption);

  const commit = (next: number) => updateAttributes({ size: next >= MAX_IMAGE_SIZE ? null : next });

  // Drag a side handle: the image stays centred, so it grows on both sides.
  const startResize = (side: "left" | "right") => (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const column = figure.current?.getBoundingClientRect().width;
    if (!column) return;
    const startX = event.clientX;
    const startSize = stored;
    let latest = startSize;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent) => {
      // Centred, it grows on both sides; against an edge, only the dragged side moves.
      const delta = (moveEvent.clientX - startX) * (side === "right" ? 1 : -1) * (align === "center" ? 2 : 1);
      const raw = startSize + (delta / column) * 100;
      latest = Math.min(MAX_IMAGE_SIZE, Math.max(MIN_IMAGE_SIZE, Math.round(raw / SIZE_STEP) * SIZE_STEP));
      setDragSize(latest);
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      setDragSize(null);
      if (latest !== startSize) commit(latest);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  // Arrow keys on a focused handle resize too.
  const keyResize = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = stored + (event.key === "ArrowRight" ? SIZE_STEP : -SIZE_STEP);
    commit(Math.min(MAX_IMAGE_SIZE, Math.max(MIN_IMAGE_SIZE, next)));
  };

  const handleClass =
    "absolute top-1/2 h-12 w-2.5 -translate-y-1/2 cursor-ew-resize touch-none rounded-full border border-background bg-foreground/80 shadow-sm opacity-0 transition-opacity group-hover/image:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring";

  return (
    <NodeViewWrapper
      as="figure"
      ref={figure}
      className={cn(
        "my-6 flex flex-col",
        align === "left" ? "items-start" : align === "right" ? "items-end" : "items-center",
      )}
      data-drag-handle
    >
      <div className="group/image relative" style={{ width: `${size}%` }}>
        {selected && (
          <div
            contentEditable={false}
            role="toolbar"
            aria-label="Image"
            className="absolute top-2 left-1/2 z-[1] flex -translate-x-1/2 items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-md"
          >
            {SIZE_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant={stored === preset.size ? "secondary" : "ghost"}
                size="sm"
                className="h-8 px-2 text-xs"
                aria-label={preset.name}
                aria-pressed={stored === preset.size}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(preset.size)}
              >
                {preset.label}
              </Button>
            ))}
            <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
            {ALIGNMENTS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={align === option.value ? "secondary" : "ghost"}
                size="icon"
                className="size-8"
                aria-label={option.name}
                aria-pressed={align === option.value}
                title={
                  stored >= MAX_IMAGE_SIZE ? `${option.name} (make it smaller to see the difference)` : option.name
                }
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => updateAttributes({ align: option.value === "center" ? null : option.value })}
              >
                <option.icon className="size-4" />
              </Button>
            ))}
            <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="relative h-8 px-2 text-xs">
                  Alt text
                  {missingAlt && (
                    <span
                      className="absolute right-1 top-1 size-1.5 rounded-full bg-destructive"
                      aria-label="missing"
                    />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 space-y-3" align="center">
                <div className="space-y-1.5">
                  <Label htmlFor={`${uid}-alt`} className="text-xs">
                    Alt text
                  </Label>
                  <Textarea
                    id={`${uid}-alt`}
                    value={decorative ? "" : alt}
                    disabled={decorative}
                    maxLength={300}
                    rows={3}
                    placeholder="What does the image show?"
                    onChange={(event) => updateAttributes({ alt: event.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`${uid}-decorative`}
                    checked={decorative}
                    onCheckedChange={(checked) => updateAttributes({ decorative: checked === true })}
                  />
                  <Label htmlFor={`${uid}-decorative`} className="text-xs font-normal">
                    Decorative, screen readers skip it
                  </Label>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant={showCaption ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2 text-xs"
              aria-pressed={showCaption}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (showCaption) {
                  setCaptionOpen(false);
                  updateAttributes({ caption: null });
                } else setCaptionOpen(true);
              }}
            >
              Caption
            </Button>
            <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Remove image"
              onMouseDown={(event) => event.preventDefault()}
              onClick={deleteNode}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- CDN image inside the editor
          <img
            src={src}
            alt={decorative ? "" : alt}
            draggable={false}
            className={cn(
              "block h-auto w-full rounded-lg border",
              selected && "outline-2 outline-offset-2 outline-ring",
              missingAlt && "border-destructive",
            )}
          />
        ) : (
          <div className="flex h-32 items-center justify-center rounded-lg border text-sm text-muted-foreground">
            Image
          </div>
        )}
        {(["left", "right"] as const).map((side) => (
          <button
            key={side}
            type="button"
            contentEditable={false}
            draggable={false}
            aria-label={`Resize image (${size}% wide). Arrow keys change it.`}
            className={cn(
              handleClass,
              side === "left" ? "-left-1.5" : "-right-1.5",
              (selected || dragSize !== null) && "opacity-100",
            )}
            onPointerDown={startResize(side)}
            onKeyDown={keyResize}
            onDragStart={(event) => event.preventDefault()}
          />
        ))}
        {dragSize !== null && (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-background/90 px-1.5 py-0.5 text-xs tabular-nums shadow-sm">
            {dragSize}%
          </span>
        )}
      </div>
      {showCaption && (
        <input
          contentEditable={false}
          value={caption ?? ""}
          maxLength={300}
          autoFocus={captionOpen && !caption}
          placeholder="Write a caption"
          aria-label="Caption"
          onChange={(event) => updateAttributes({ caption: event.target.value || null })}
          className={cn(
            "mt-2 w-full bg-transparent text-sm text-muted-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:text-foreground",
            align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center",
          )}
          style={{ maxWidth: `${size}%` }}
        />
      )}
    </NodeViewWrapper>
  );
}

const CmsImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      assetId: { default: null },
      alt: { default: "" },
      decorative: { default: false },
      caption: { default: null },
      src: { default: null },
      width: { default: null },
      height: { default: null },
      size: { default: null },
      align: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "figure[data-cms-image]" }];
  },
  renderHTML({ node }) {
    return ["figure", { "data-cms-image": node.attrs.assetId }, ["img", { src: node.attrs.src, alt: node.attrs.alt }]];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});

const CALLOUT_ICONS: Record<CalloutVariant, typeof Info> = { info: Info, tip: Lightbulb, warning: TriangleAlert };
const CALLOUT_STYLES: Record<CalloutVariant, string> = {
  info: "border-sky-500/40 bg-sky-500/5",
  tip: "border-emerald-500/40 bg-emerald-500/5",
  warning: "border-amber-500/40 bg-amber-500/5",
};
export const CALLOUT_LABELS: Record<CalloutVariant, string> = { info: "Note", tip: "Tip", warning: "Warning" };

function CalloutView({ node, updateAttributes }: ReactNodeViewProps) {
  const variant = (node.attrs.variant as CalloutVariant) ?? "info";
  const Icon = CALLOUT_ICONS[variant];
  return (
    <NodeViewWrapper className={cn("my-4 flex gap-3 rounded-lg border-l-4 p-3", CALLOUT_STYLES[variant])}>
      <div contentEditable={false} className="flex flex-col items-center gap-1 pt-0.5">
        <Icon className="size-4" aria-hidden />
        <select
          value={variant}
          onChange={(event) => updateAttributes({ variant: event.target.value })}
          aria-label="Callout type"
          className="rounded border bg-background px-1 text-xs"
        >
          {CALLOUT_VARIANTS.map((option) => (
            <option key={option} value={option}>
              {CALLOUT_LABELS[option]}
            </option>
          ))}
        </select>
      </div>
      <NodeViewContent className="min-w-0 flex-1" />
    </NodeViewWrapper>
  );
}

const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      variant: {
        default: "info",
        parseHTML: (element) => element.getAttribute("data-callout") ?? "info",
        renderHTML: (attributes) => ({ "data-callout": attributes.variant }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },
});

export const EMBED_LABELS: Record<string, string> = {
  youtube: "YouTube video",
  twitch_clip: "Twitch clip",
  twitch_video: "Twitch VOD",
};

function EmbedView({ node, deleteNode, selected }: ReactNodeViewProps) {
  const { provider, id } = node.attrs as { provider: string; id: string };
  return (
    <NodeViewWrapper
      data-drag-handle
      className={cn(
        "my-4 flex items-center gap-3 rounded-lg border bg-muted/30 p-4 text-sm",
        selected && "ring-2 ring-ring",
      )}
    >
      <Film className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{EMBED_LABELS[provider] ?? provider}</p>
        <p className="truncate text-xs text-muted-foreground">{id}</p>
      </div>
      <button
        type="button"
        onClick={deleteNode}
        className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
        aria-label="Remove embed"
      >
        <X className="size-4" />
      </button>
    </NodeViewWrapper>
  );
}

const Embed = Node.create({
  name: "embed",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { provider: { default: null }, id: { default: null } };
  },
  parseHTML() {
    return [{ tag: "div[data-embed]" }];
  },
  renderHTML({ node }) {
    return ["div", { "data-embed": node.attrs.provider, "data-id": node.attrs.id }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(EmbedView);
  },
});

export const CODE_LANGUAGES = [
  "",
  "bash",
  "css",
  "html",
  "javascript",
  "json",
  "lua",
  "python",
  "typescript",
  "yaml",
] as const;

export function cmsExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      heading: { levels: ALLOWED_LEVELS },
      underline: false,
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        isAllowedUri: (url) => sanitizeHref(url) !== null,
        HTMLAttributes: { rel: "noopener", target: null },
      },
    }),
    TableKit.configure({ table: { resizable: false } }),
    Placeholder.configure({ placeholder }),
    CharacterCount,
    HeadingAnchor,
    CmsImage,
    Callout,
    Embed,
  ];
}
