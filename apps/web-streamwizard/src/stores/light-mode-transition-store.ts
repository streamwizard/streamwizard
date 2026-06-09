import { create } from "zustand";

interface LightModeTransitionState {
  isPlaying: boolean;
  hasTriggered: boolean;
  trigger: () => void;
  reset: () => void;
}

export const useThemeTransitionStore = create<LightModeTransitionState>((set, get) => ({
  isPlaying: false,
  hasTriggered: false,
  trigger: () => {
    if (get().hasTriggered) return;
    set({ isPlaying: true, hasTriggered: true });
  },
  reset: () => set({ isPlaying: false, hasTriggered: false }),
}));
