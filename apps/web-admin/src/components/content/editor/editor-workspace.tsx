"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Editor } from "@tiptap/react";

// Everything the rich text editors on one page share: a single formatting
// toolbar that follows whichever editor was focused last, the list of all
// editors (find and replace works across them), and the places a link can
// point to. Outside a workspace a RichTextEditor brings its own toolbar.

export type EditorDialog = "image" | "link" | "embed" | "docx";

export interface EditorHandle {
  id: string;
  /** "Intro", "Section 2 text", … */
  label: string;
  editor: Editor;
  open: (dialog: EditorDialog) => void;
}

/** A page a link can point to, offered by the link dialog's search. */
export interface LinkTarget {
  label: string;
  href: string;
  /** "Guide", "Blog post · draft", "On this page", … */
  hint: string;
}

interface Workspace {
  register: (handle: EditorHandle) => () => void;
  focus: (id: string) => void;
  /** The editor the toolbar works on: the last one focused, else the first. */
  active: EditorHandle | null;
  /** Every editor on the page, in the order they mounted. */
  editors: EditorHandle[];
  linkTargets: LinkTarget[];
}

const WorkspaceContext = createContext<Workspace | null>(null);

export function useEditorWorkspace(): Workspace | null {
  return useContext(WorkspaceContext);
}

export function EditorWorkspace({ linkTargets, children }: { linkTargets: LinkTarget[]; children: React.ReactNode }) {
  const [handles, setHandles] = useState<EditorHandle[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const register = useCallback((handle: EditorHandle) => {
    setHandles((current) => [...current.filter((h) => h.id !== handle.id), handle]);
    return () => setHandles((current) => current.filter((h) => h.id !== handle.id));
  }, []);

  const value = useMemo<Workspace>(
    () => ({
      register,
      focus: setActiveId,
      active: handles.find((handle) => handle.id === activeId) ?? handles[0] ?? null,
      editors: handles,
      linkTargets,
    }),
    [register, handles, activeId, linkTargets],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
