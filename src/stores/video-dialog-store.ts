"use client";

import { createClipFromVOD, getStreamEvents } from "@/actions/twitch/vods";
import type { TwitchPlayer } from "@/components/vods/twitch-player";
import type { TimelineEvent } from "@/components/vods/timeline/types";
import type { Database } from "@/types/supabase";
import { getEventDisplayData, StreamEventType } from "@/types/stream-events";
import { TwitchVideo, parseDuration } from "@/types/twitch video";
import { create } from "zustand";

type StreamEvent = Database["public"]["Tables"]["stream_events"]["Row"];

/**
 * Convert StreamEvent (database format) to TimelineEvent (UI format)
 */
function toTimelineEvent(event: StreamEvent): TimelineEvent {
  const displayData = getEventDisplayData(event);
  const offset = event.offset_seconds || 0;
  const userName = displayData.userName || event.event_type;
  const message = displayData.message;

  return {
    id: event.id,
    offset,
    type: event.event_type as StreamEventType,
    label: displayData.,
    details: message,
  };
}

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

  // Player state
  player: TwitchPlayer | null;
  isPlaying: boolean;
  isMuted: boolean;
  currentTime: number;
  isPlayerReady: boolean;
  playerKey: number;

  // Stream events state
  events: StreamEvent[];
  filteredEvents: StreamEvent[];
  timelineEvents: TimelineEvent[];
  selectedEventTypes: Set<string>;
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
  setVideo: (video: TwitchVideo | null) => void;

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
  setFilteredEvents: (events: StreamEvent[]) => void;
  setIsLoadingEvents: (loading: boolean) => void;
  fetchEvents: (streamId: string) => Promise<void>;
  seekToEvent: (eventId: string) => void;
  toggleEventType: (type: string) => void;
  selectAllEventTypes: () => void;
  deselectAllEventTypes: () => void;

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

  // Player state
  player: null,
  isPlaying: false,
  isMuted: true,
  currentTime: 0,
  isPlayerReady: false,
  playerKey: 0,

  // Stream events state
  events: [],
  filteredEvents: [],
  timelineEvents: [],
  selectedEventTypes: new Set<string>([
    "channel.follow",
    "channel.subscribe",
    "channel.subscription.message",
    "channel.subscription.gift",
    "channel.raid",
    "channel.cheer",
    "channel.ban",
    "channel.unban",
    "channel.shoutout.create",
    "channel.shoutout.receive",
    "channel.channel_points_custom_reward_redemption.add",
    "channel.moderator.add",
    "channel.moderator.remove",
  ]),
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
  setVideo: (video) => set({ video }),

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
  setFilteredEvents: (events) => set({ filteredEvents: events }),
  setIsLoadingEvents: (loading) => set({ isLoadingEvents: loading }),
  fetchEvents: async (streamId) => {
    set({ isLoadingEvents: true });
    try {
      const result = await getStreamEvents(streamId);
      if (result.success && result.events) {
        const { selectedEventTypes } = get();
        const filtered = result.events.filter((event) => selectedEventTypes.has(event.event_type));
        const timeline = filtered.map(toTimelineEvent);
        set({ events: result.events, filteredEvents: filtered, timelineEvents: timeline });
      } else {
        set({ events: [], filteredEvents: [], timelineEvents: [] });
      }
    } catch (error) {
      console.error("Failed to fetch stream events:", error);
      set({ events: [], filteredEvents: [], timelineEvents: [] });
    } finally {
      set({ isLoadingEvents: false });
    }
  },

  seekToEvent: (eventId: string) => {
    const { events, seek } = get();
    const event = events.find((e) => e.id === eventId);
    if (event) {
      seek(event.offset_seconds as number);
    }
  },

  toggleEventType: (type: string) => {
    const { selectedEventTypes, events } = get();
    const next = new Set(selectedEventTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    // Update filtered events and timeline events
    const filtered = events.filter((event) => next.has(event.event_type));
    const timeline = filtered.map(toTimelineEvent);
    set({ selectedEventTypes: next, filteredEvents: filtered, timelineEvents: timeline });
  },

  selectAllEventTypes: () => {
    const { events } = get();
    const allTypes = new Set<string>([
      "channel.follow",
      "channel.subscribe",
      "channel.subscription.message",
      "channel.subscription.gift",
      "channel.raid",
      "channel.cheer",
      "channel.ban",
      "channel.unban",
      "channel.shoutout.create",
      "channel.shoutout.receive",
      "channel.channel_points_custom_reward_redemption.add",
      "channel.moderator.add",
      "channel.moderator.remove",
    ]);
    // Update filtered events and timeline events to include all
    const filtered = events.filter((event) => allTypes.has(event.event_type));
    const timeline = filtered.map(toTimelineEvent);
    set({ selectedEventTypes: allTypes, filteredEvents: filtered, timelineEvents: timeline });
  },

  deselectAllEventTypes: () => {
    set({ selectedEventTypes: new Set<string>(), filteredEvents: [], timelineEvents: [] });
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
    const { seek } = get();
    set({
      clipStartTime: start,
      clipEndTime: end,
    });

    seek(start);
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
