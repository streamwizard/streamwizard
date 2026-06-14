import { create } from "zustand";
import type { SessionPreferences } from "@/lib/session";

interface SessionStoreState {
  preferences: SessionPreferences;
  setPreferences: (preferences: SessionPreferences) => void;
  setPreference: <K extends keyof SessionPreferences>(key: K, value: SessionPreferences[K]) => void;
}

export const useSessionStore = create<SessionStoreState>((set) => ({
  preferences: {
    memes_enabled: true,
    sync_clips_on_end: true,
    onboarding_completed: false,
    show_stream_stats: true,
  },
  setPreferences: (preferences) => set({ preferences }),
  setPreference: (key, value) =>
    set((state) => ({ preferences: { ...state.preferences, [key]: value } })),
}));
