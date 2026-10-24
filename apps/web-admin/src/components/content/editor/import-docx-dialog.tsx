"use client";

import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cleanPastedHtml } from "@repo/cms";
import { Button } from "@repo/ui";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/widgets/responsive-dialog";

// A Word file, read in the browser and put through the same cleaner as a
// paste. Nothing is uploaded: mammoth turns the .docx into HTML here, and
// cleanPastedHtml cuts it down to what the page can draw.

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
/** Big enough for any article, small enough not to lock up the tab. */
const MAX_BYTES = 20 * 1024 * 1024;

export function ImportDocxDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const read = async (file: File) => {
    if (file.size > MAX_BYTES) return void toast.error("That file is too big to read here. Split it up first.");
    setBusy(true);
    try {
      // Loaded on demand: mammoth has no business in the editor's bundle.
      const mammoth = await import("mammoth");
      const { value, messages } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
      const { html, report } = cleanPastedHtml(value);
      if (!html.trim()) return void toast.error("There was no text in that file.");

      editor.chain().focus().insertContent(html).run();
      onClose();

      if (report.images.length > 0) {
        toast.warning(
          `${report.images.length === 1 ? "One image" : `${report.images.length} images`} stayed behind: add them from the media library.`,
        );
      }
      if (messages.some((message) => message.type === "error")) {
        toast.message("Some of the document's formatting had no match here and was left out.");
      }
    } catch {
      toast.error("Couldn't read that file. Is it a .docx?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Import a Word file</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            The text, headings, lists, links and tables come across. Styling and images don&apos;t: pick images from
            the media library afterwards.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <input
          ref={input}
          type="file"
          accept=".docx"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            if (file.type && file.type !== DOCX) return void toast.error("Pick a .docx file.");
            void read(file);
          }}
        />
        <Button type="button" variant="outline" className="h-24 w-full" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
          {busy ? "Reading…" : "Choose a .docx file"}
        </Button>
        <ResponsiveDialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
