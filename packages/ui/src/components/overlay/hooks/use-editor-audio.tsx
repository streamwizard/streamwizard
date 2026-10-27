"use client";

import { createContext, useContext, type ReactNode } from "react";

// Only the dashboard's editor canvas mounts the provider. The live overlay
// never does, so a widget there always reads false and plays its sound.
const EditorAudioMutedContext = createContext(false);

export function EditorAudioProvider({
  muted,
  children,
}: {
  muted: boolean;
  children: ReactNode;
}) {
  return (
    <EditorAudioMutedContext.Provider value={muted}>{children}</EditorAudioMutedContext.Provider>
  );
}

/** True while the streamer has muted the editor. Always false on a live overlay. */
export function useEditorAudioMuted(): boolean {
  return useContext(EditorAudioMutedContext);
}
