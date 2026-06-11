"use client";

import { TwitchClipDialog } from "@/components/modals/twitch-clip-dialog";
import { clipsWithFolders } from "@/types/database";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ClipDialogContextType = {
  openClip: (clip: clipsWithFolders) => void;
};

const ClipDialogContext = createContext<ClipDialogContextType | null>(null);

export function ClipDialogProvider({ children }: { children: ReactNode }) {
  const [clip, setClip] = useState<clipsWithFolders | null>(null);
  const [open, setOpen] = useState(false);

  const openClip = useCallback((next: clipsWithFolders) => {
    setClip(next);
    setOpen(true);
  }, []);

  return (
    <ClipDialogContext.Provider value={{ openClip }}>
      {children}
      <TwitchClipDialog clip={clip} open={open} onOpenChange={setOpen} />
    </ClipDialogContext.Provider>
  );
}

export function useClipDialog() {
  const context = useContext(ClipDialogContext);
  if (!context) {
    throw new Error("useClipDialog must be used within a ClipDialogProvider");
  }
  return context;
}
