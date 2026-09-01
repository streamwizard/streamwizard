/**
 * The editor's full shortcut list, written out by hand.
 *
 * Nothing here is derived, so it goes stale the moment a binding changes. The
 * keyboard handler lives in `overlay-editor.tsx` and the drag modifiers in
 * `hooks/overlays/use-canvas-gestures.ts` — change one of those, change this.
 *
 * `"Mod"` renders as Cmd on a Mac and Ctrl everywhere else.
 */

export interface EditorShortcut {
  action: string;
  /** One row of key chips per accepted combo, so alternates stack. */
  combos: string[][];
}

export interface EditorShortcutGroup {
  title: string;
  description: string;
  shortcuts: EditorShortcut[];
}

export const MOD_KEY_TOKEN = "Mod";

/** Opens the reference itself; shown next to the title rather than in a group. */
export const SHORTCUTS_DIALOG_KEY = "?";

export const EDITOR_SHORTCUT_GROUPS: EditorShortcutGroup[] = [
  {
    title: "Editing",
    description: "Work anywhere in the editor, except while you're typing in a field.",
    shortcuts: [
      { action: "Save the overlay", combos: [[MOD_KEY_TOKEN, "S"]] },
      { action: "Undo", combos: [[MOD_KEY_TOKEN, "Z"]] },
      { action: "Redo", combos: [[MOD_KEY_TOKEN, "Shift", "Z"], [MOD_KEY_TOKEN, "Y"]] },
      { action: "Duplicate what's selected", combos: [[MOD_KEY_TOKEN, "D"]] },
      { action: "Delete what's selected", combos: [["Delete"], ["Backspace"]] },
    ],
  },
  {
    title: "Selection",
    description: "Picking what the next thing you press applies to.",
    shortcuts: [
      {
        action: "Add a widget to the selection, or drop it back out",
        combos: [["Shift", "Click"]],
      },
      { action: "Deselect everything", combos: [["Esc"]] },
    ],
  },
  {
    title: "Canvas",
    description: "Nudging, and the modifiers you hold while dragging.",
    shortcuts: [
      { action: "Fit the scene on screen", combos: [["Shift", "1"]] },
      { action: "Zoom back to 100%", combos: [["Shift", "0"]] },
      { action: "Show or hide the grid", combos: [["Shift", "G"]] },
      { action: "Show or hide the rulers", combos: [["Shift", "R"]] },
      { action: "Snap to the grid, on and off", combos: [["Shift", "S"]] },
      { action: "Nudge by 1 pixel", combos: [["↑", "↓", "←", "→"]] },
      { action: "Nudge by 10 pixels", combos: [["Shift", "↑", "↓", "←", "→"]] },
      { action: "Ignore the snap guides while dragging", combos: [["Alt", "Drag"]] },
      { action: "Crop instead of resize", combos: [["Alt", "Drag a resize handle"]] },
      { action: "Stretch instead of scale", combos: [["Shift", "Drag a corner handle"]] },
    ],
  },
];
