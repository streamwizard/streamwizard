"use client";

import { create } from "zustand";
import { TwitchVideo, parseDuration } from "@/types/twitch video";
import { getStreamEvents, createClipFromVOD } from "@/actions/twitch/vods";
import type { Database } from "@/types/supabase";
import type { TwitchPlayer } from "@/components/vods/twitch-player";

type StreamEvent = Database["public"]["Tables"]["stream_events"]["Row"];

/** Drag handle type for clip selection */
export type DragHandle = "start" | "end" | "middle" | null;

/** Drag start info for middle handle dragging */
export interface DragStartInfo {
  clientX: number;
  startTime: number;
  endTime: number;
}

export interface VideoDialogState {
  // Dialog state
  video: TwitchVideo | null;
  isOpen: boolean;

  // Player state
  player: TwitchPlayer | null;
  isPlaying: boolean;
  isMuted: boolean;
  currentTime: number;
  isPlayerReady: boolean;
  playerKey: number;

  // Stream events state
  events: StreamEvent[];
  isLoadingEvents: boolean;

  // Clip creation state
  isCreatingClip: boolean;
  clipTitle: string;
  clipStartTime: number;
  clipEndTime: number;
  isSubmittingClip: boolean;

  // Timeline state
  zoomLevel: number;
  viewOffset: number;
  dragging: DragHandle;
  dragStartInfo: DragStartInfo | null;
}

export interface VideoDialogActions {
  // Dialog actions
  openDialog: (video: TwitchVideo) => void;
  closeDialog: () => void;
  setOpen: (open: boolean) => void;

  // Player actions
  setPlayer: (player: TwitchPlayer | null) => void;
  setPlayerReady: (ready: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsMuted: (muted: boolean) => void;
  setCurrentTime: (time: number) => void;
  incrementPlayerKey: () => void;

  // Playback controls
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  toggleMute: () => void;
  seek: (seconds: number) => void;

  // Event actions
  setEvents: (events: StreamEvent[]) => void;
  setIsLoadingEvents: (loading: boolean) => void;
  fetchEvents: (streamId: string) => Promise<void>;

  // Clip creation actions
  startClipCreation: () => void;
  cancelClipCreation: () => void;
  setClipTitle: (title: string) => void;
  setClipStartTime: (time: number) => void;
  setClipEndTime: (time: number) => void;
  setClipSelection: (start: number, end: number) => void;
  saveClip: () => Promise<{ success: boolean; error?: string; editUrl?: string; clipId?: string }>;

  // Utility actions
  seekToClipStart: () => void;
  resetState: () => void;

  // Timeline actions
  setZoomLevel: (zoom: number) => void;
  setViewOffset: (offset: number) => void;
  zoomIn: (centerPoint?: number) => void;
  zoomOut: (centerPoint?: number) => void;
  setDragging: (handle: DragHandle) => void;
  setDragStartInfo: (info: DragStartInfo | null) => void;
  initializeZoomForClip: () => void;
  resetZoom: () => void;
}

export type VideoDialogStore = VideoDialogState & VideoDialogActions;

const initialState: VideoDialogState = {
  // Dialog state
  video: null,
  isOpen: false,

  // Player state
  player: null,
  isPlaying: false,
  isMuted: true,
  currentTime: 0,
  isPlayerReady: false,
  playerKey: 0,

  // Stream events state
  events: [],
  isLoadingEvents: false,

  // Clip creation state
  isCreatingClip: false,
  clipTitle: "",
  clipStartTime: 0,
  clipEndTime: 30,
  isSubmittingClip: false,

  // Timeline state
  zoomLevel: 1,
  viewOffset: 0,
  dragging: null,
  dragStartInfo: null,
};

export const useVideoDialogStore = create<VideoDialogStore>((set, get) => ({
  ...initialState,

  // Dialog actions
  openDialog: (video) => {
    set({
      video,
      isOpen: true,
      playerKey: get().playerKey + 1,
    });

    // Fetch events if stream_id exists
    if (video.stream_id) {
      get().fetchEvents(video.stream_id);
    }
  },

  closeDialog: () => {
    get().resetState();
  },

  setOpen: (open) => {
    if (!open) {
      get().resetState();
    } else {
      set({ isOpen: open });
    }
  },

  // Player actions
  setPlayer: (player) => set({ player }),

  setPlayerReady: (ready) => set({ isPlayerReady: ready }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setIsMuted: (muted) => set({ isMuted: muted }),

  setCurrentTime: (time) => set({ currentTime: time }),

  incrementPlayerKey: () => set((state) => ({ playerKey: state.playerKey + 1 })),

  // Playback controls
  play: () => {
    const { player, isPlayerReady } = get();
    if (player && isPlayerReady) {
      player.play();
    }
  },

  pause: () => {
    const { player, isPlayerReady } = get();
    if (player && isPlayerReady) {
      player.pause();
    }
  },

  togglePlay: () => {
    const { isPlaying } = get();
    if (isPlaying) {
      get().pause();
    } else {
      get().play();
    }
  },

  toggleMute: () => {
    const { player, isMuted, isPlayerReady } = get();
    if (player && isPlayerReady) {
      const newMuted = !isMuted;
      player.setMuted(newMuted);
      set({ isMuted: newMuted });
    }
  },

  seek: (seconds) => {
    const { player, isPlayerReady } = get();
    if (player && isPlayerReady) {
      player.seek(seconds);
      set({ currentTime: seconds });
    }
  },

  // Event actions
  setEvents: (events) => set({ events }),

  setIsLoadingEvents: (loading) => set({ isLoadingEvents: loading }),

  fetchEvents: async (streamId) => {
    set({ isLoadingEvents: true });
    try {
      const result = await getStreamEvents(streamId);
      if (result.success && result.events) {
        set({ events: result.events });
      } else {
        set({ events: [] });
      }
    } catch (error) {
      console.error("Failed to fetch stream events:", error);
      set({ events: [] });
    } finally {
      set({ isLoadingEvents: false });
    }
  },

  // Clip creation actions
  startClipCreation: () => {
    const { video, currentTime, isPlayerReady, seek } = get();
    if (!video || !isPlayerReady) return;

    const totalDuration = parseDuration(video.duration);
    const start = Math.max(0, currentTime - 15);
    const end = Math.min(totalDuration, currentTime + 15);

    set({
      isCreatingClip: true,
      clipStartTime: start,
      clipEndTime: end,
    });

    // Seek to clip start
    seek(start);
  },

  cancelClipCreation: () => {
    set({
      isCreatingClip: false,
      clipTitle: "",
    });
  },

  setClipTitle: (title) => set({ clipTitle: title }),

  setClipStartTime: (time) => set({ clipStartTime: time }),

  setClipEndTime: (time) => set({ clipEndTime: time }),

  setClipSelection: (start, end) => {
    set({
      clipStartTime: start,
      clipEndTime: end,
    });
  },

  saveClip: async () => {
    const { video, clipTitle, clipStartTime, clipEndTime } = get();

    if (!video?.id || !clipTitle.trim()) {
      return { success: false, error: "Missing video ID or clip title" };
    }

    set({ isSubmittingClip: true });

    try {
      // Calculate duration and vod_offset
      // Note: vod_offset is where the clip ENDS
      // The clip will start at (vod_offset - duration) and end at vod_offset
      const duration = clipEndTime - clipStartTime;
      const vod_offset = clipEndTime;

      const result = await createClipFromVOD({
        vodId: video.id,
        vod_offset: vod_offset,
        duration: duration,
        title: clipTitle,
      });

      if (result.success) {
        // Reset clip creation state on success
        get().cancelClipCreation();
        return {
          success: true,
          editUrl: result.editUrl,
          clipId: result.clipId,
        };
      } else {
        return {
          success: false,
          error: result.error || "Failed to create clip",
        };
      }
    } catch (error) {
      console.error("Error creating clip:", error);
      return {
        success: false,
        error: "An unexpected error occurred while creating the clip",
      };
    } finally {
      set({ isSubmittingClip: false });
    }
  },

  // Utility actions
  seekToClipStart: () => {
    const { clipStartTime } = get();
    get().seek(clipStartTime);
  },

  resetState: () => {
    set({
      ...initialState,
      // Keep playerKey to ensure fresh player on next open
      playerKey: get().playerKey,
    });
  },

  // Timeline actions
  setZoomLevel: (zoom) => set({ zoomLevel: zoom }),

  setViewOffset: (offset) => set({ viewOffset: offset }),

  zoomIn: (centerPoint) => {
    const { video, zoomLevel, clipStartTime, clipEndTime, currentTime } = get();
    if (!video) return;

    const totalSeconds = parseDuration(video.duration);
    const newZoom = Math.min(zoomLevel * 1.5, 20);
    const center = (centerPoint ?? (clipStartTime + clipEndTime) / 2) || currentTime;
    const newVisibleDuration = totalSeconds / newZoom;
    const newOffset = Math.max(0, center - newVisibleDuration / 2);

    set({
      zoomLevel: newZoom,
      viewOffset: Math.min(newOffset, totalSeconds - newVisibleDuration),
    });
  },

  zoomOut: (centerPoint) => {
    const { video, zoomLevel, clipStartTime, clipEndTime, currentTime } = get();
    if (!video) return;

    const totalSeconds = parseDuration(video.duration);
    const newZoom = Math.max(zoomLevel / 1.5, 1);
    const center = (centerPoint ?? (clipStartTime + clipEndTime) / 2) || currentTime;
    const newVisibleDuration = totalSeconds / newZoom;
    const newOffset = Math.max(0, center - newVisibleDuration / 2);

    set({
      zoomLevel: newZoom,
      viewOffset: newZoom === 1 ? 0 : Math.min(newOffset, totalSeconds - newVisibleDuration),
    });
  },

  setDragging: (handle) => set({ dragging: handle }),

  setDragStartInfo: (info) => set({ dragStartInfo: info }),

  initializeZoomForClip: () => {
    const { video, clipStartTime, clipEndTime } = get();
    if (!video) return;

    const totalSeconds = parseDuration(video.duration);
    const clipCenter = (clipStartTime + clipEndTime) / 2;
    const clipDuration = clipEndTime - clipStartTime;
    // Set zoom to show approximately 5x the clip duration
    const newZoom = Math.max(1, totalSeconds / (clipDuration * 5));
    const clampedZoom = Math.min(newZoom, 20);
    const newOffset = Math.max(0, clipCenter - totalSeconds / clampedZoom / 2);

    set({
      zoomLevel: clampedZoom,
      viewOffset: Math.min(newOffset, totalSeconds - totalSeconds / clampedZoom),
    });
  },

  resetZoom: () => {
    set({
      zoomLevel: 1,
      viewOffset: 0,
    });
  },
}));

// Selector hooks for commonly used derived state
export const useVideoDialogVideo = () => useVideoDialogStore((state) => state.video);
export const useVideoDialogIsOpen = () => useVideoDialogStore((state) => state.isOpen);
export const useVideoDialogPlayerReady = () => useVideoDialogStore((state) => state.isPlayerReady);
export const useVideoDialogIsPlaying = () => useVideoDialogStore((state) => state.isPlaying);
export const useVideoDialogIsMuted = () => useVideoDialogStore((state) => state.isMuted);
export const useVideoDialogCurrentTime = () => useVideoDialogStore((state) => state.currentTime);
export const useVideoDialogEvents = () => useVideoDialogStore((state) => state.events);
export const useVideoDialogIsLoadingEvents = () => useVideoDialogStore((state) => state.isLoadingEvents);
export const useVideoDialogIsCreatingClip = () => useVideoDialogStore((state) => state.isCreatingClip);
export const useVideoDialogClipSelection = () =>
  useVideoDialogStore((state) => ({
    startTime: state.clipStartTime,
    endTime: state.clipEndTime,
  }));
