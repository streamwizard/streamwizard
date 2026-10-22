"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
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
  Search,
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
import type { CmsMediaItem } from "@/lib/cms/media-items";
import { CMS_IMAGE_TYPES } from "@/lib/cms/media";
import { FormField } from "../form-field";
import { ImagePickerDialog } from "../image-picker-dialog";
import { ImageUploadDialog } from "../image-upload-dialog";
import { useEditorWorkspace, type EditorDialog, type LinkTarget } from "./editor-workspace";
import { CODE_LANGUAGES, cmsExtensions } from "./extensions";

// Prose styles for the editing surface. The public site has its own; these
// only need to make the structure (headings, lists, quotes) obvious.
const SURFACE =
  "min-h-64 px-4 py-3 text-sm leading-7 focus:outline-none " +
  "[&_:is(h2,h3,h4)]:scroll-mt-32 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:mt-4 [&_h4]:font-semibold " +
  "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 " +
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground " +
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

// Typed text that already looks like an address, rather than words to search for.
const LOOKS_LIKE_URL = /^(#|\/|[a-z][a-z0-9+.-]*:)|\.[a-z]{2,}(\/|$)/i;
const MAX_MATCHES = 6;

function LinkDialog({ editor, targets, onClose }: { editor: Editor; targets: LinkTarget[]; onClose: () => void }) {
  const uid = useId();
  const current = editor.getAttributes("link").href as string | undefined;
  const [href, setHref] = useState(current ?? "");
  const query = href.trim();
  const searching = query !== "" && !LOOKS_LIKE_URL.test(query);
  const matches = useMemo(() => {
    if (!searching) return [];
    const words = query.toLowerCase().split(/\s+/);
    return targets
      .filter((target) => words.every((word) => target.label.toLowerCase().includes(word)))
      .slice(0, MAX_MATCHES);
  }, [searching, query, targets]);

  const setLink = (value: string) => {
    if (!value) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return onClose();
    }
    const clean = sanitizeHref(value.match(/^[a-z]+:|^\/|^#/i) ? value : `https://${value}`);
    if (!clean) return void toast.error("Use a full https:// link, a site link like /pricing, or #section.");
    editor.chain().focus().extendMarkRange("link").setLink({ href: clean }).run();
    onClose();
  };
  // Words that match a page link to it; anything else is taken as typed.
  const apply = () => setLink(searching && matches[0] ? matches[0].href : query);

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{current ? "Edit link" : "Add link"}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Search your posts and guides, or paste a link. Leave it empty to remove the link.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <FormField label="Link to" htmlFor={`${uid}-href`} hint="A title, https://…, /pricing or #a-heading">
            <Input
              id={`${uid}-href`}
              value={href}
              autoFocus
              autoComplete="off"
              role="combobox"
              aria-expanded={matches.length > 0}
              aria-controls={`${uid}-matches`}
              onChange={(event) => setHref(event.target.value)}
            />
          </FormField>
        </form>
        {searching && (
          <ul id={`${uid}-matches`} role="listbox" aria-label="Matching pages" className="-mx-1 space-y-0.5">
            {matches.length === 0 ? (
              <li className="px-2 py-1.5 text-sm text-muted-foreground">Nothing matches. Paste a full link instead.</li>
            ) : (
              matches.map((target, index) => (
                <li key={target.href} role="option" aria-selected={index === 0}>
                  <button
                    type="button"
                    onClick={() => setLink(target.href)}
                    className={cn(
                      "flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                      index === 0 && "bg-muted/60",
                    )}
                  >
                    <span className="min-w-0 truncate">{target.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{target.hint}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
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
  onFind,
  className,
}: {
  editor: Editor;
  onImage: () => void;
  onLink: () => void;
  onEmbed: () => void;
  onFind?: () => void;
  className?: string;
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
      className={cn(
        "sticky top-14 z-[5] flex flex-wrap items-center gap-0.5 rounded-t-lg border-b bg-background/95 p-1 backdrop-blur",
        className,
      )}
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
      {onFind && <ToolButton label="Find and replace (Ctrl H)" icon={Search} onClick={onFind} />}
      <ToolButton label="Undo" icon={Undo} disabled={!state.canUndo} onClick={() => chain().undo().run()} />
      <ToolButton label="Redo" icon={Redo} disabled={!state.canRedo} onClick={() => chain().redo().run()} />
    </div>
  );
}

/** The node the picker and an upload insert: one image, with the asset's own alt text. */
function imageNode(asset: CmsMediaItem) {
  return {
    type: "image",
    attrs: {
      assetId: asset.id,
      alt: asset.decorative ? "" : asset.alt,
      decorative: asset.decorative,
      src: asset.url,
      width: asset.width,
      height: asset.height,
    },
  };
}

/** Image files in a paste or a drop, in the formats the media library takes. */
function imageFiles(data: DataTransfer | null): File[] {
  return [...(data?.files ?? [])].filter((file) => file.type in CMS_IMAGE_TYPES);
}

/** Bold, italic and link right at the selection, so formatting doesn't mean a trip to the toolbar. */
function SelectionMenu({ editor, onLink }: { editor: Editor; onLink: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      link: e.isActive("link"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
    }),
  });
  const chain = () => editor.chain().focus();
  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: e, view, from, to }) =>
        // Hidden once focus leaves the editor (a dialog opened, the writer clicked away).
        view.hasFocus() && from !== to && !e.isActive("image") && !e.isActive("embed") && !e.isActive("codeBlock")
      }
    >
      <div
        role="toolbar"
        aria-label="Format selection"
        className="flex gap-0.5 rounded-lg border bg-popover p-1 shadow-md"
      >
        <ToolButton label="Bold" icon={Bold} active={state.bold} onClick={() => chain().toggleBold().run()} />
        <ToolButton label="Italic" icon={Italic} active={state.italic} onClick={() => chain().toggleItalic().run()} />
        <ToolButton label="Link" icon={LinkIcon} active={state.link} onClick={onLink} />
        <span className="mx-0.5 my-1.5 w-px bg-border" aria-hidden />
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
      </div>
    </BubbleMenu>
  );
}

/**
 * The one toolbar of a workspace, sticky above the writing column. It works
 * on whichever editor was focused last.
 */
export function WorkspaceToolbar({ onFind }: { onFind: () => void }) {
  const workspace = useEditorWorkspace();
  const active = workspace?.active;
  if (!active) return <div className="h-11 rounded-lg border" aria-hidden />;
  return (
    <Toolbar
      key={active.id}
      editor={active.editor}
      onImage={() => active.open("image")}
      onLink={() => active.open("link")}
      onEmbed={() => active.open("embed")}
      onFind={onFind}
      className="rounded-lg border shadow-xs"
    />
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
  const id = useId();
  const workspace = useEditorWorkspace();
  const register = workspace?.register;
  const focusWorkspace = workspace?.focus;
  const [dialog, setDialog] = useState<EditorDialog | null>(null);
  // An image pasted or dropped in: it needs alt text before it can upload.
  const [incoming, setIncoming] = useState<{ file: File; pos: number } | null>(null);
  const editorRef = useRef<Editor | null>(null);

  const receive = (files: File[], pos: number) => {
    if (files.length === 0) return false;
    if (files.length > 1) toast.message("One image at a time: the first one is ready to upload.");
    setIncoming({ file: files[0]!, pos });
    return true;
  };

  const editor = useEditor({
    extensions: cmsExtensions(placeholder),
    content: initial,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: SURFACE, "aria-label": label },
      handlePaste: (view, event) => receive(imageFiles(event.clipboardData), view.state.selection.from),
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
        return receive(imageFiles(event.dataTransfer), at?.pos ?? view.state.selection.from);
      },
    },
    // A plain copy: ProseMirror keeps node attributes (image ids, heading
    // levels, callout variants, link targets) in null-prototype objects, which
    // React can't send to a server action. They'd arrive as "$T" placeholders
    // and the save would drop or reset every one of them.
    onUpdate: ({ editor: e }) => onChange(structuredClone(e.getJSON()) as Doc),
  });

  useEffect(() => {
    editorRef.current = editor;
    if (!editor || !register || !focusWorkspace) return;
    const unregister = register({ id, label, editor, open: setDialog });
    const onFocus = () => focusWorkspace(id);
    editor.on("focus", onFocus);
    return () => {
      editor.off("focus", onFocus);
      unregister();
    };
  }, [editor, register, focusWorkspace, id, label]);

  const insertImage = (asset: CmsMediaItem, pos?: number) => {
    const chain = editorRef.current?.chain().focus();
    if (!chain) return;
    if (pos === undefined) return void chain.insertContent(imageNode(asset)).run();
    // Text may have moved while the alt text was written: stay inside the document.
    const size = editorRef.current!.state.doc.content.size;
    chain.insertContentAt(Math.min(pos, size), imageNode(asset)).run();
  };

  return (
    <div className={cn("rounded-lg border bg-background", className)}>
      {editor && !workspace && (
        <Toolbar
          editor={editor}
          onImage={() => setDialog("image")}
          onLink={() => setDialog("link")}
          onEmbed={() => setDialog("embed")}
        />
      )}
      {/* Gone while one of this editor's dialogs is open, so it can't float over it. */}
      {editor && !dialog && !incoming && <SelectionMenu editor={editor} onLink={() => setDialog("link")} />}
      <EditorContent editor={editor} />

      {editor && dialog === "link" && (
        <LinkDialog editor={editor} targets={workspace?.linkTargets ?? []} onClose={() => setDialog(null)} />
      )}
      {editor && dialog === "embed" && <EmbedDialog editor={editor} onClose={() => setDialog(null)} />}
      <ImagePickerDialog
        open={dialog === "image"}
        onOpenChange={(open) => !open && setDialog(null)}
        purpose="content"
        onPick={(asset) => insertImage(asset)}
      />
      <ImageUploadDialog
        open={incoming !== null}
        initialFile={incoming?.file}
        onOpenChange={(open) => !open && setIncoming(null)}
        purpose="content"
        onUploaded={(asset) => incoming && insertImage(asset, incoming.pos)}
      />
    </div>
  );
}
