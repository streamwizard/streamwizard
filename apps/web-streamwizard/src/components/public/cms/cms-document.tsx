import type { ReactNode } from "react";
import Image from "next/image";
import { Info, Lightbulb, TriangleAlert } from "lucide-react";
import {
  embedSrc,
  isEmbedProvider,
  sanitizeHref,
  type CalloutVariant,
  type Doc,
  type DocMark,
  type DocNode,
} from "@repo/cms";

// Renders a stored Tiptap document as React, node by node. The document was
// cleaned by @repo/cms sanitizeDoc before it was saved, and this only knows
// the nodes on that allowlist: anything else renders nothing. No HTML string
// is ever built or injected.

export interface ResolvedImage {
  src: string;
  width: number | null;
  height: number | null;
}

export interface CmsDocumentProps {
  doc: Doc;
  /** Heading anchors in document order, from @repo/cms pageOutline. */
  anchors: string[];
  /** Where an image node's file lives. null hides the image. */
  resolveImage: (attrs: Record<string, unknown>) => ResolvedImage | null;
  /** This site's hostname: Twitch embeds only play when they are told it. */
  parentHost: string;
}

interface Context {
  anchors: string[];
  heading: number;
  resolveImage: CmsDocumentProps["resolveImage"];
  parentHost: string;
}

const CALLOUTS: Record<CalloutVariant, { label: string; icon: typeof Info; className: string }> = {
  info: { label: "Note", icon: Info, className: "border-sky-400/60 bg-sky-400/[0.06]" },
  tip: { label: "Tip", icon: Lightbulb, className: "border-emerald-400/60 bg-emerald-400/[0.06]" },
  warning: { label: "Heads up", icon: TriangleAlert, className: "border-amber-400/70 bg-amber-400/[0.07]" },
};

const EMBED_TITLES: Record<string, string> = {
  youtube: "YouTube video",
  twitch_clip: "Twitch clip",
  twitch_video: "Twitch video",
};

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href) || href.startsWith("mailto:");
}

function wrapMark(mark: DocMark, child: ReactNode, key: string): ReactNode {
  switch (mark.type) {
    case "bold":
      return <strong key={key}>{child}</strong>;
    case "italic":
      return <em key={key}>{child}</em>;
    case "strike":
      return <s key={key}>{child}</s>;
    case "code":
      return <code key={key}>{child}</code>;
    case "link": {
      // Checked again here even though saving already did: a renderer that
      // trusts its input is one bad migration away from a javascript: link.
      const href = sanitizeHref(mark.attrs?.href);
      if (!href) return child;
      return (
        <a key={key} href={href} rel={isExternal(href) ? "noopener noreferrer" : undefined}>
          {child}
        </a>
      );
    }
    default:
      return child;
  }
}

function renderText(node: DocNode, key: string): ReactNode {
  // Link outermost, so a link spans its bold or italic words.
  const marks = [...(node.marks ?? [])].sort((a, b) => (a.type === "link" ? 1 : 0) - (b.type === "link" ? 1 : 0));
  return marks.reduce<ReactNode>((child, mark, index) => wrapMark(mark, child, `${key}-${index}`), node.text ?? "");
}

function children(node: DocNode, ctx: Context, key: string): ReactNode[] {
  return (node.content ?? []).map((child, index) => renderNode(child, ctx, `${key}.${index}`));
}

function renderNode(node: DocNode, ctx: Context, key: string): ReactNode {
  switch (node.type) {
    case "text":
      return renderText(node, key);
    case "hardBreak":
      return <br key={key} />;
    case "paragraph":
      return <p key={key}>{children(node, ctx, key)}</p>;
    case "heading": {
      const level = node.attrs?.level === 3 ? 3 : node.attrs?.level === 4 ? 4 : 2;
      const id = ctx.anchors[ctx.heading++];
      const Tag = `h${level}` as "h2" | "h3" | "h4";
      return (
        <Tag key={key} id={id} className="group scroll-mt-24">
          {children(node, ctx, key)}
          {id && (
            <a
              href={`#${id}`}
              className="ml-2 no-underline opacity-0 transition-opacity group-hover:opacity-60 focus-visible:opacity-100"
              aria-label="Link to this section"
            >
              #
            </a>
          )}
        </Tag>
      );
    }
    case "bulletList":
      return <ul key={key}>{children(node, ctx, key)}</ul>;
    case "orderedList": {
      const start = typeof node.attrs?.start === "number" && node.attrs.start !== 1 ? node.attrs.start : undefined;
      return (
        <ol key={key} start={start}>
          {children(node, ctx, key)}
        </ol>
      );
    }
    case "listItem":
      return <li key={key}>{children(node, ctx, key)}</li>;
    case "blockquote":
      return <blockquote key={key}>{children(node, ctx, key)}</blockquote>;
    case "codeBlock": {
      const language = typeof node.attrs?.language === "string" ? node.attrs.language : null;
      return (
        <pre key={key} tabIndex={0}>
          <code className={language ? `language-${language}` : undefined}>
            {(node.content ?? []).map((child) => child.text ?? "").join("")}
          </code>
        </pre>
      );
    }
    case "horizontalRule":
      return <hr key={key} />;
    case "callout": {
      const variant =
        (node.attrs?.variant as CalloutVariant) in CALLOUTS ? (node.attrs!.variant as CalloutVariant) : "info";
      const { label, icon: Icon, className } = CALLOUTS[variant];
      return (
        <aside
          key={key}
          role="note"
          aria-label={label}
          className={`not-prose my-6 flex gap-3 rounded-xl border-l-4 px-4 py-3 ${className}`}
        >
          <Icon aria-hidden className="mt-1 size-4 shrink-0" />
          <div className="cms-callout min-w-0 space-y-2 [&_p]:m-0">{children(node, ctx, key)}</div>
        </aside>
      );
    }
    case "image": {
      const attrs = node.attrs ?? {};
      const image = ctx.resolveImage(attrs);
      if (!image) return null;
      const alt = attrs.decorative === true ? "" : typeof attrs.alt === "string" ? attrs.alt : "";
      const caption = typeof attrs.caption === "string" && attrs.caption ? attrs.caption : null;
      return (
        <figure key={key} className="my-8">
          {image.width && image.height ? (
            <Image
              src={image.src}
              alt={alt}
              width={image.width}
              height={image.height}
              sizes="(min-width: 768px) 720px, 100vw"
              className="h-auto w-full rounded-xl border border-white/[0.08]"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- no stored size to give next/image
            <img
              src={image.src}
              alt={alt}
              loading="lazy"
              className="h-auto w-full rounded-xl border border-white/[0.08]"
            />
          )}
          {caption && <figcaption className="mt-2 text-center text-sm text-muted-foreground">{caption}</figcaption>}
        </figure>
      );
    }
    case "embed": {
      const provider = node.attrs?.provider;
      const id = node.attrs?.id;
      if (!isEmbedProvider(provider) || typeof id !== "string") return null;
      return (
        <div
          key={key}
          className="not-prose my-8 aspect-video overflow-hidden rounded-xl border border-white/[0.08] bg-black"
        >
          <iframe
            src={embedSrc({ provider, id }, ctx.parentHost)}
            title={EMBED_TITLES[provider] ?? "Video"}
            loading="lazy"
            allow="fullscreen; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            className="size-full"
          />
        </div>
      );
    }
    case "table":
      return (
        <div key={key} className="my-6 overflow-x-auto" tabIndex={0}>
          <table>
            <tbody>{children(node, ctx, key)}</tbody>
          </table>
        </div>
      );
    case "tableRow":
      return <tr key={key}>{children(node, ctx, key)}</tr>;
    case "tableHeader":
    case "tableCell": {
      const Cell = node.type === "tableHeader" ? "th" : "td";
      const colSpan =
        typeof node.attrs?.colspan === "number" && node.attrs.colspan > 1 ? node.attrs.colspan : undefined;
      const rowSpan =
        typeof node.attrs?.rowspan === "number" && node.attrs.rowspan > 1 ? node.attrs.rowspan : undefined;
      return (
        <Cell key={key} colSpan={colSpan} rowSpan={rowSpan} scope={node.type === "tableHeader" ? "col" : undefined}>
          {children(node, ctx, key)}
        </Cell>
      );
    }
    default:
      return null;
  }
}

export function CmsDocument({ doc, anchors, resolveImage, parentHost }: CmsDocumentProps) {
  const ctx: Context = { anchors, heading: 0, resolveImage, parentHost };
  return <>{doc.content.map((node, index) => renderNode(node, ctx, String(index)))}</>;
}

/**
 * Article typography. No typography plugin in this app, so the styles are
 * spelled out: Geist, the site's muted foreground for body text, the wizard
 * purple only as an underline (it fails contrast as small text on light).
 */
export const CMS_PROSE =
  "text-base leading-8 text-foreground/90 " +
  "[&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground " +
  "[&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-foreground [&_h4]:mt-6 [&_h4]:mb-2 [&_h4]:font-semibold [&_h4]:text-foreground " +
  "[&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1.5 [&_li>p]:my-1 " +
  "[&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:decoration-[var(--color-three)] [&_a]:decoration-2 [&_a]:underline-offset-4 hover:[&_a]:decoration-foreground " +
  "[&_strong]:font-semibold [&_strong]:text-foreground " +
  "[&_blockquote]:my-6 [&_blockquote]:border-l-2 [&_blockquote]:border-white/20 [&_blockquote]:pl-5 [&_blockquote]:text-muted-foreground " +
  "[&_code]:rounded [&_code]:bg-white/[0.06] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] " +
  "[&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-white/[0.08] [&_pre]:bg-black/40 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:leading-6 " +
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
  "[&_hr]:my-10 [&_hr]:border-white/10 " +
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_th]:border-white/10 [&_th]:bg-white/[0.04] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left " +
  "[&_td]:border [&_td]:border-white/10 [&_td]:px-3 [&_td]:py-2";
