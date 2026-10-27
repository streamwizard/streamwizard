"use client";

import { createContext, useContext, type ReactNode } from "react";

/** A value typed into the editor's Saved data tab for one stream label. */
export interface EditorLabelValue {
  name?: string;
  amount?: number;
}

/** Numbers typed in for a goal widget, so a bar can be tried at any fill. */
export interface EditorGoalValue {
  current?: number;
  target?: number;
}

export interface EditorPreviewValues {
  /** By LABEL_CATALOG id. */
  labels: Record<string, EditorLabelValue>;
  /** By goal widget type (follower_goal_widget, ...). */
  goals: Record<string, EditorGoalValue>;
}

const EMPTY: EditorPreviewValues = { labels: {}, goals: {} };

// Only the dashboard's editor canvas mounts the provider, so on a live overlay
// every widget reads the empty default and shows its real data.
const EditorPreviewValuesContext = createContext<EditorPreviewValues>(EMPTY);

export function EditorPreviewValuesProvider({
  values,
  children,
}: {
  values: EditorPreviewValues;
  children: ReactNode;
}) {
  return (
    <EditorPreviewValuesContext.Provider value={values}>{children}</EditorPreviewValuesContext.Provider>
  );
}

export function useEditorPreviewValues(): EditorPreviewValues {
  return useContext(EditorPreviewValuesContext);
}
