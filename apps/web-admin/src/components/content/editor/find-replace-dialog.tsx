"use client";

import { useId, useMemo, useState } from "react";
import type { Editor } from "@tiptap/react";
import { toast } from "sonner";
import { Button, Checkbox, Input, Label } from "@repo/ui";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/widgets/responsive-dialog";
import { FormField } from "../form-field";
import { useEditorWorkspace } from "./editor-workspace";

// Find and replace across the whole post: the plain fields (title, summary,
// SEO text, section titles) and every rich text editor. Text in an editor is
// replaced through the editor itself, so formatting stays and Ctrl+Z undoes
// it there. A match has to sit inside one run of formatting: half bold, half
// not, it isn't found.

export interface PlainField {
  label: string;
  value: string;
}

function patternFor(find: string, matchCase: boolean): RegExp | null {
  if (!find) return null;
  return new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), matchCase ? "g" : "gi");
}

function editorRanges(editor: Editor, pattern: RegExp): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    for (const match of node.text.matchAll(pattern)) {
      ranges.push({ from: pos + match.index, to: pos + match.index + match[0].length });
    }
  });
  return ranges;
}

export function FindReplaceDialog({
  open,
  onOpenChange,
  fields,
  onReplaceFields,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: PlainField[];
  /** Applies a replacement to every plain field at once. */
  onReplaceFields: (replace: (text: string) => string) => void;
}) {
  const uid = useId();
  const workspace = useEditorWorkspace();
  const [find, setFind] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const pattern = patternFor(find, matchCase);
  const editors = workspace?.editors ?? [];

  const places = useMemo(() => {
    if (!pattern) return [];
    return [
      ...fields.map((field) => ({ label: field.label, count: field.value.match(pattern)?.length ?? 0 })),
      ...editors.map((handle) => ({ label: handle.label, count: editorRanges(handle.editor, pattern).length })),
    ].filter((place) => place.count > 0);
    // The editors' text isn't React state: a new search term or toggle is what re-counts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [find, matchCase, fields, editors]);
  const total = places.reduce((sum, place) => sum + place.count, 0);

  const replaceAll = () => {
    if (!pattern || total === 0) return;
    onReplaceFields((text) => text.replace(pattern, () => replacement));
    for (const { editor } of editors) {
      const ranges = editorRanges(editor, pattern);
      if (ranges.length === 0) continue;
      const tr = editor.state.tr;
      // Back to front, so earlier positions stay valid.
      for (const { from, to } of ranges.reverse()) {
        if (replacement) tr.insertText(replacement, from, to);
        else tr.delete(from, to);
      }
      editor.view.dispatch(tr);
    }
    toast.success(`Replaced ${total} ${total === 1 ? "match" : "matches"}.`);
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Find and replace</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>Across the whole post: text, titles and SEO fields.</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            replaceAll();
          }}
        >
          <FormField label="Find" htmlFor={`${uid}-find`}>
            <Input
              id={`${uid}-find`}
              value={find}
              autoFocus
              autoComplete="off"
              onChange={(event) => setFind(event.target.value)}
            />
          </FormField>
          <FormField label="Replace with" htmlFor={`${uid}-replace`} hint="Leave it empty to delete every match.">
            <Input
              id={`${uid}-replace`}
              value={replacement}
              autoComplete="off"
              onChange={(event) => setReplacement(event.target.value)}
            />
          </FormField>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${uid}-case`}
              checked={matchCase}
              onCheckedChange={(checked) => setMatchCase(checked === true)}
            />
            <Label htmlFor={`${uid}-case`}>Match upper and lower case</Label>
          </div>
        </form>
        {pattern && (
          <div className="text-sm" role="status" aria-live="polite">
            {total === 0 ? (
              <p className="text-muted-foreground">No matches.</p>
            ) : (
              <>
                <p className="font-medium">
                  {total} {total === 1 ? "match" : "matches"}
                </p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {places.map((place) => (
                    <li key={place.label} className="flex justify-between gap-3">
                      <span className="truncate">{place.label}</span>
                      <span className="tabular-nums">{place.count}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        <ResponsiveDialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={replaceAll} disabled={total === 0}>
            Replace all
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
