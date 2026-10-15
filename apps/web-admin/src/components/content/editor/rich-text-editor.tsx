"use client";

import { useId, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import {
  Bold,
  Code,
  Film,
  Heading2,
  Heading3,
  Heading4,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Megaphone,
  Minus,
  Quote,
  Redo,
  SquareCode,
  Strikethrough,
  Table as TableIcon,
  Undo,
} from "lucide-react";
import { toast } from "sonner";
import { parseEmbedUrl, sanitizeHref, type Doc } from "@repo/cms";
import { Button, Input } from "@repo/ui";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/widgets/responsive-dialog";
import { cn } from "@/lib/utils";
import { FormField } from "../form-field";
import { ImagePickerDialog } from "../image-picker-dialog";
import { CODE_LANGUAGES, cmsExtensions } from "./extensions";

// Prose styles for the editing surface. The public site has its own; these
// only need to make the structure (headings, lists, quotes) obvious.
const SURFACE =
  "min-h-64 px-4 py-3 text-sm leading-7 focus:outline-none " +
  "[&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:mt-4 [&_h4]:font-semibold " +
  "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 " +
  "[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground " +
  "[&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 " +
  "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
  "[&_hr]:my-6 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-muted [&_th]:p-2 [&_th]:text-left " +
  "[&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 " +
  "[&_.is-editor-empty:first-child::before]:text-muted-foreground [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]";

function ToolButton({
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon: typeof Bold;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon"
      className="size-9 md:size-8"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <Icon className="size-4" />
    </Button>
  );
}

function LinkDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const uid = useId();
  const current = editor.getAttributes("link").href as string | undefined;
  const [href, setHref] = useState(current ?? "");

  const apply = () => {
    if (!href.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return onClose();
    }
    const clean = sanitizeHref(href.trim().match(/^[a-z]+:|^\/|^#/i) ? href.trim() : `https://${href.trim()}`);
    if (!clean) return void toast.error("Use a full https:// link, a site link like /pricing, or #section.");
    editor.chain().focus().extendMarkRange("link").setLink({ href: clean }).run();
    onClose();
  };

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{current ? "Edit link" : "Add link"}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>Leave it empty to remove the link.</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <FormField label="URL" htmlFor={`${uid}-href`} hint="https://…, /guides/obs-setup or #a-heading">
            <Input id={`${uid}-href`} value={href} autoFocus onChange={(event) => setHref(event.target.value)} />
          </FormField>
        </form>
        <ResponsiveDialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={apply}>Apply</Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function EmbedDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const uid = useId();
  const [url, setUrl] = useState("");

  const insert = () => {
    const embed = parseEmbedUrl(url);
    if (!embed) return void toast.error("Paste a YouTube video, Twitch clip or Twitch VOD link.");
    editor.chain().focus().insertContent({ type: "embed", attrs: embed }).run();
    onClose();
  };

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Embed a video</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>YouTube videos, Twitch clips and Twitch VODs.</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            insert();
          }}
        >
          <FormField label="Link" htmlFor={`${uid}-url`}>
            <Input
              id={`${uid}-url`}
              value={url}
              autoFocus
              placeholder="https://clips.twitch.tv/…"
              onChange={(event) => setUrl(event.target.value)}
            />
          </FormField>
        </form>
        <ResponsiveDialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={insert} disabled={!url.trim()}>
            Embed
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function Toolbar({
  editor,
  onImage,
  onLink,
  onEmbed,
}: {
  editor: Editor;
  onImage: () => void;
  onLink: () => void;
  onEmbed: () => void;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      h4: e.isActive("heading", { level: 4 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      language: (e.getAttributes("codeBlock").language as string | null) ?? "",
      callout: e.isActive("callout"),
      table: e.isActive("table"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b bg-background/95 p-1 backdrop-blur"
    >
      <ToolButton
        label="Heading 2"
        icon={Heading2}
        active={state.h2}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      />
      <ToolButton
        label="Heading 3"
        icon={Heading3}
        active={state.h3}
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
      />
      <ToolButton
        label="Heading 4"
        icon={Heading4}
        active={state.h4}
        onClick={() => chain().toggleHeading({ level: 4 }).run()}
      />
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <ToolButton label="Bold" icon={Bold} active={state.bold} onClick={() => chain().toggleBold().run()} />
      <ToolButton label="Italic" icon={Italic} active={state.italic} onClick={() => chain().toggleItalic().run()} />
      <ToolButton
        label="Strikethrough"
        icon={Strikethrough}
        active={state.strike}
        onClick={() => chain().toggleStrike().run()}
      />
      <ToolButton label="Inline code" icon={Code} active={state.code} onClick={() => chain().toggleCode().run()} />
      <ToolButton label="Link" icon={LinkIcon} active={state.link} onClick={onLink} />
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <ToolButton
        label="Bulleted list"
        icon={List}
        active={state.bulletList}
        onClick={() => chain().toggleBulletList().run()}
      />
      <ToolButton
        label="Numbered list"
        icon={ListOrdered}
        active={state.orderedList}
        onClick={() => chain().toggleOrderedList().run()}
      />
      <ToolButton
        label="Quote"
        icon={Quote}
        active={state.blockquote}
        onClick={() => chain().toggleBlockquote().run()}
      />
      <ToolButton
        label="Callout"
        icon={Megaphone}
        active={state.callout}
        onClick={() => chain().toggleWrap("callout", { variant: "info" }).run()}
      />
      <ToolButton
        label="Code block"
        icon={SquareCode}
        active={state.codeBlock}
        onClick={() => chain().toggleCodeBlock().run()}
      />
      {state.codeBlock && (
        <select
          aria-label="Code language"
          value={state.language}
          onChange={(event) =>
            chain()
              .updateAttributes("codeBlock", { language: event.target.value || null })
              .run()
          }
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          {CODE_LANGUAGES.map((language) => (
            <option key={language} value={language}>
              {language || "Plain text"}
            </option>
          ))}
        </select>
      )}
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <ToolButton label="Image" icon={ImagePlus} onClick={onImage} />
      <ToolButton label="Embed video" icon={Film} onClick={onEmbed} />
      <ToolButton
        label={state.table ? "Delete table" : "Table"}
        icon={TableIcon}
        active={state.table}
        onClick={() =>
          state.table
            ? chain().deleteTable().run()
            : chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      />
      <ToolButton label="Divider" icon={Minus} onClick={() => chain().setHorizontalRule().run()} />
      <span className="ml-auto" />
      <ToolButton label="Undo" icon={Undo} disabled={!state.canUndo} onClick={() => chain().undo().run()} />
      <ToolButton label="Redo" icon={Redo} disabled={!state.canRedo} onClick={() => chain().redo().run()} />
    </div>
  );
}

interface RichTextEditorProps {
  /** Starting content. The editor owns it from then on; remount (key) to replace it. */
  initial: Doc;
  onChange: (doc: Doc) => void;
  placeholder: string;
  label: string;
  className?: string;
}

export function RichTextEditor({ initial, onChange, placeholder, label, className }: RichTextEditorProps) {
  const [dialog, setDialog] = useState<"image" | "link" | "embed" | null>(null);
  const editor = useEditor({
    extensions: cmsExtensions(placeholder),
    content: initial,
    immediatelyRender: false,
    editorProps: { attributes: { class: SURFACE, "aria-label": label } },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as Doc),
  });

  return (
    <div className={cn("rounded-lg border bg-background", className)}>
      {editor && (
        <Toolbar
          editor={editor}
          onImage={() => setDialog("image")}
          onLink={() => setDialog("link")}
          onEmbed={() => setDialog("embed")}
        />
      )}
      <EditorContent editor={editor} />

      {editor && dialog === "link" && <LinkDialog editor={editor} onClose={() => setDialog(null)} />}
      {editor && dialog === "embed" && <EmbedDialog editor={editor} onClose={() => setDialog(null)} />}
      <ImagePickerDialog
        open={dialog === "image"}
        onOpenChange={(open) => !open && setDialog(null)}
        purpose="content"
        onPick={(asset) =>
          editor
            ?.chain()
            .focus()
            .insertContent({
              type: "image",
              attrs: {
                assetId: asset.id,
                alt: asset.decorative ? "" : asset.alt,
                decorative: asset.decorative,
                src: asset.url,
                width: asset.width,
                height: asset.height,
              },
            })
            .run()
        }
      />
    </div>
  );
}
