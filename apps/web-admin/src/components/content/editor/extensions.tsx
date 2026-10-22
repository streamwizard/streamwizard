"use client";

import { useId } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { TableKit } from "@tiptap/extension-table";
import { Film, Info, Lightbulb, TriangleAlert, X } from "lucide-react";
import { CALLOUT_VARIANTS, MAX_HEADING_LEVEL, MIN_HEADING_LEVEL, sanitizeHref, type CalloutVariant } from "@repo/cms";
import { Checkbox, Input, Label } from "@repo/ui";
import { cn } from "@/lib/utils";
import { HeadingAnchor } from "./heading-anchor";

// The editor's schema. It mirrors @repo/cms sanitizeDoc's allowlist: nothing
// the public renderer can't draw can be typed or pasted in. Pasted <img> tags
// are dropped on purpose; images only come from the media library.

const ALLOWED_LEVELS = Array.from(
  { length: MAX_HEADING_LEVEL - MIN_HEADING_LEVEL + 1 },
  (_, i) => MIN_HEADING_LEVEL + i,
) as (2 | 3 | 4)[];

function ImageView({ node, updateAttributes, deleteNode, selected }: ReactNodeViewProps) {
  const uid = useId();
  const { src, alt, decorative, caption } = node.attrs as {
    src: string | null;
    alt: string;
    decorative: boolean;
    caption: string | null;
  };
  const missingAlt = !decorative && !alt.trim();
  return (
    <NodeViewWrapper
      as="figure"
      data-drag-handle
      className={cn(
        "my-4 rounded-lg border bg-muted/30 p-3",
        selected && "ring-2 ring-ring",
        missingAlt && "border-destructive",
      )}
    >
      <div className="relative">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- CDN image inside the editor
          <img src={src} alt={decorative ? "" : alt} className="mx-auto max-h-80 rounded-md object-contain" />
        ) : (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">Image</div>
        )}
        <button
          type="button"
          onClick={deleteNode}
          className="absolute right-1 top-1 rounded-md bg-background/90 p-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Remove image"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-3 grid gap-2" contentEditable={false}>
        <Label htmlFor={`${uid}-alt`} className="text-xs">
          Alt text {missingAlt && <span className="text-destructive">(needed)</span>}
        </Label>
        <Input
          id={`${uid}-alt`}
          value={decorative ? "" : alt}
          disabled={decorative}
          maxLength={300}
          placeholder="What does the image show?"
          onChange={(event) => updateAttributes({ alt: event.target.value })}
        />
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${uid}-decorative`}
            checked={decorative}
            onCheckedChange={(checked) => updateAttributes({ decorative: checked === true })}
          />
          <Label htmlFor={`${uid}-decorative`} className="text-xs font-normal">
            Decorative
          </Label>
        </div>
        <Input
          value={caption ?? ""}
          maxLength={300}
          placeholder="Caption (optional)"
          aria-label="Caption"
          onChange={(event) => updateAttributes({ caption: event.target.value || null })}
        />
      </div>
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
