"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import {
  Bold,
  ChevronDown,
  Code,
  FileUp,
  Film,
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
import { cleanPastedHtml, parseEmbedUrl, sanitizeHref, type Doc, type PasteReport } from "@repo/cms";
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Input,
} from "@repo/ui";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/widgets/responsive-dialog";
import type { BlockId } from "@/lib/cms/blocks";
import { activeTextStyle, TEXT_STYLES, textStyleLabel, type TextStyle, type TextStyleId } from "@/lib/cms/text-styles";
import { cn } from "@/lib/utils";
import { FormField } from "../form-field";
import { ImagePickerDialog } from "../image-picker-dialog";
import { BlockHandle } from "./block-handle";
import { ImportDocxDialog } from "./import-docx-dialog";
import { BlockInserter, insertBlock } from "./block-inserter";
import { CODE_LANGUAGES, cmsExtensions } from "./extensions";
import { SlashMenu, SlashMenuList, type SlashMenuState } from "./slash-menu";

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

/** The one control a writer looks for first, in words rather than H2/H3. */
function TextStyleMenu({ active, onPick }: { active: TextStyleId; onPick: (style: TextStyle) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" className="h-9 justify-between gap-1 px-2 text-sm md:h-8 md:w-40">
          <span className="truncate">{textStyleLabel(active)}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {TEXT_STYLES.map((style) => (
          <DropdownMenuCheckboxItem
            key={style.id}
            checked={style.id === active}
            onSelect={() => onPick(style)}
            className={style.id === "h2" ? "text-base font-semibold" : style.id === "h3" ? "font-semibold" : undefined}
          >
            {style.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Toolbar({
  editor,
  onImage,
  onLink,
  onEmbed,
  onImport,
}: {
  editor: Editor;
  onImage: () => void;
  onLink: () => void;
  onEmbed: () => void;
  onImport: () => void;
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
      <TextStyleMenu
        active={activeTextStyle(state)}
        onPick={(style) =>
          style.level === null ? chain().setParagraph().run() : chain().setHeading({ level: style.level }).run()
        }
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
      <ToolButton label="Import a Word file" icon={FileUp} onClick={onImport} />
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

/** What the writer is told about a paste that didn't arrive whole. */
function reportPaste(report: PasteReport, onAddImages: () => void) {
  if (report.images.length > 0) {
    const count = report.images.length;
    toast.warning(
      count === 1
        ? "One image didn't come along: images live in the media library."
        : `${count} images didn't come along: images live in the media library.`,
      { action: { label: "Add images", onClick: onAddImages } },
    );
  }
  if (report.headingsRemapped > 0) {
    const where = report.source === "google-docs" ? "Google Docs" : report.source === "word" ? "Word" : "the page";
    toast.message(`Pasted from ${where}. Headings were matched to this page's levels.`);
  }
}

export function RichTextEditor({ initial, onChange, placeholder, label, className }: RichTextEditorProps) {
  const [dialog, setDialog] = useState<"image" | "link" | "embed" | "docx" | null>(null);
  const [slash, setSlash] = useState<SlashMenuState | null>(null);
  // Every callback here is a stable setState, so the extensions can be built
  // once: useEditor takes them at mount and never looks again.
  const pickBlock = useCallback((instance: Editor, id: BlockId) => insertBlock(instance, id, setDialog), []);
  const extensions = useMemo(
    () => [...cmsExtensions(placeholder), SlashMenu.configure({ onChange: setSlash, onPick: pickBlock })],
    [placeholder, pickBlock],
  );
  const editor = useEditor({
    extensions,
    content: initial,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: SURFACE, "aria-label": label },
      // Google Docs' and Word's own markup, tidied before ProseMirror parses
      // it: what the schema drops afterwards can no longer be explained to
      // the writer, and pasted images are only visible here.
      transformPastedHTML: (html) => {
        const { html: clean, report } = cleanPastedHtml(html);
        // This runs inside ProseMirror's dispatch; toasts are React state.
        if (report.images.length > 0 || report.headingsRemapped > 0) {
          queueMicrotask(() => reportPaste(report, () => setDialog("image")));
        }
        return clean;
      },
    },
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
          onImport={() => setDialog("docx")}
        />
      )}
      {editor && <BlockInserter editor={editor} onDialog={setDialog} />}
      {editor && slash && (
        <SlashMenuList
          state={slash}
          onPick={(item) => {
            setSlash(null);
            insertBlock(editor, item.id, setDialog);
          }}
        />
      )}
      {editor && <BlockHandle editor={editor} />}
      <EditorContent editor={editor} />

      {editor && dialog === "link" && <LinkDialog editor={editor} onClose={() => setDialog(null)} />}
      {editor && dialog === "embed" && <EmbedDialog editor={editor} onClose={() => setDialog(null)} />}
      {editor && dialog === "docx" && <ImportDocxDialog editor={editor} onClose={() => setDialog(null)} />}
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
