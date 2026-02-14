"use client";

import { getStreamData, createClipFromVOD, getStreamMarkers, createStreamMarker } from "@/actions/twitch/vods";
import type { TwitchPlayer } from "@/components/vods/twitch-player";
import type { TimelineEvent } from "@/components/vods/timeline/types";
import type { Database } from "@/types/supabase";
import { StreamEventType, type Clip } from "@/types/stream-events";
import { getStreamEventDisplayInfo } from "@/lib/utils/stream-events";
import { TwitchVideo, parseDuration, type TwitchStreamMarker } from "@/types/twitch video";
import { create } from "zustand";
import { toast } from "sonner";

type StreamEvent = Database["public"]["Tables"]["stream_events"]["Row"];

/**
 * Convert StreamEvent (database format) to TimelineEvent (UI format)
 */
function toTimelineEvent(event: StreamEvent): TimelineEvent {
  const displayInfo = getStreamEventDisplayInfo(event);
  const offset = event.offset_seconds || 0;

  return {
    id: event.id,
    offset,
    type: event.event_type as StreamEventType,
    label: displayInfo.label,
    details: displayInfo.message,
  };
}

/**
 * Convert a Clip to a pseudo-StreamEvent so it can be displayed in the events panel
 */
function clipToStreamEvent(clip: Clip): StreamEvent {
  return {
    id: `clip-${clip.id}`,
    created_at: clip.created_at_twitch,
    updated_at: clip.created_at_twitch,
    event_type: "clip",
    provider: "twitch",
    broadcaster_id: clip.broadcaster_id,
    stream_id: clip.video_id ?? "",
    event_data: {
      title: clip.title,
      creator_name: clip.creator_name,
      url: clip.url,
      view_count: clip.view_count,
      duration: clip.duration,
      id: clip.id.toString(),
      twitch_clip_id: clip.twitch_clip_id,
      folder_ids: clip.folder_ids,
    },
    metadata: null,
    status: "completed",
    offset_seconds: clip.vod_offset ?? 0,
  };
}

/**
 * Convert a TwitchStreamMarker to a pseudo-StreamEvent
 */
function markerToStreamEvent(marker: TwitchStreamMarker): StreamEvent {
  return {
    id: `marker-${marker.id}`,
    created_at: marker.created_at,
    updated_at: marker.created_at,
    event_type: "marker",
    provider: "twitch",
    broadcaster_id: "",
    stream_id: "",
    event_data: {
      description: marker.description,
      url: marker.url,
    },
    metadata: null,
    status: "completed",
    offset_seconds: marker.position_seconds,
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

export interface VideoPlayerState {
  // Dialog state
  video: TwitchVideo | null;

  // Player state
  player: TwitchPlayer | null;
  isPlaying: boolean;
  isMuted: boolean;
  currentTime: number;
  isPlayerReady: boolean;
  playerKey: number;

  // Stream events & clips state
  events: StreamEvent[];
  clips: Clip[];
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
  isSeekDisabled: boolean;
}

export interface VideoPlayerActions {
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
  fetchEvents: (videoId: string) => Promise<void>;
  seekToEvent: (eventId: string) => void;
  toggleEventType: (type: string) => void;
  selectAllEventTypes: () => void;
  deselectAllEventTypes: () => void;

  // Clip creation actions
  startClipCreation: (atOffset?: number) => void;
  cancelClipCreation: () => void;
  setClipTitle: (title: string) => void;
  setClipStartTime: (time: number) => void;
  setClipEndTime: (time: number) => void;
  setClipSelection: (start: number, end: number) => void;
  saveClip: () => Promise<{ success: boolean; error?: string; editUrl?: string; clipId?: string }>;

  // Marker actions
  createMarker: (description?: string) => Promise<void>;

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
  setIsSeekDisabled: (disabled: boolean) => void;
}

export type VideoPlayerStore = VideoPlayerState & VideoPlayerActions;

const initialState: VideoPlayerState = {
  // Dialog state
  video: null,

  // Player state
  player: null,
  isPlaying: false,
  isMuted: true,
  currentTime: 0,
  isPlayerReady: false,
  playerKey: 0,

  // Stream events & clips state
  events: [],
  clips: [],
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
    "clip",
    "marker",
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
  isSeekDisabled: false,
};

export const useVideoPlayerStore = create<VideoPlayerStore>((set, get) => ({
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
  fetchEvents: async (videoId) => {
    set({ isLoadingEvents: true });
    try {
      // Fetch stream data and markers in parallel
      const [streamDataResult, markersResult] = await Promise.all([getStreamData(videoId), getStreamMarkers(videoId)]);

      const rawEvents = streamDataResult.success ? (streamDataResult.events ?? []) : [];
      const clips = streamDataResult.success ? (streamDataResult.clips ?? []) : [];
      const markers = markersResult.success ? (markersResult.markers ?? []) : [];

      // Convert clips and markers to pseudo-StreamEvents and merge with real events
      const clipEvents = clips.map(clipToStreamEvent);
      const markerEvents = markers.map(markerToStreamEvent);
      const allEvents = [...rawEvents, ...clipEvents, ...markerEvents].sort((a, b) => (a.offset_seconds ?? 0) - (b.offset_seconds ?? 0));

      const { selectedEventTypes } = get();
      const filtered = allEvents.filter((event: StreamEvent) => selectedEventTypes.has(event.event_type));
      const timeline = filtered.map(toTimelineEvent);
      set({ events: allEvents, clips, filteredEvents: filtered, timelineEvents: timeline });
    } catch (error) {
      console.error("Failed to fetch stream data:", error);
      set({ events: [], clips: [], filteredEvents: [], timelineEvents: [] });
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
      "clip",
      "marker",
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
  startClipCreation: (atOffset?: number) => {
    const { video, currentTime, isPlayerReady, seek } = get();
    if (!video || !isPlayerReady) return;

    const totalDuration = parseDuration(video.duration);
    const center = atOffset ?? currentTime;
    const start = Math.max(0, center - 15);
    const end = Math.min(totalDuration, center + 15);

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

    const clipPromise = (async () => {
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

      if (result.success && result.data) {
        // Reset clip creation state on success and refetch events
        get().cancelClipCreation();
        const videoId = video.id;
        // Refetch events in background so the new clip appears
        get().fetchEvents(videoId);
        return {
          success: true as const,
          editUrl: result.data.editUrl,
          clipId: result.data.clipId,
        };
      } else {
        throw new Error(result.error || "Failed to create clip");
      }
    })();

    toast.promise(clipPromise, {
      loading: "Creating clip...",
      success: (data) => ({
        message: "Clip created successfully!",
        action: data.editUrl
          ? {
              label: "View Clip",
              onClick: () => window.open(data.editUrl, "_blank"),
            }
          : undefined,
        description: "It may take a few seconds for the clip to be available.",
      }),
      error: (err) => err.message || "An unexpected error occurred while creating the clip",
    });

    try {
      return await clipPromise;
    } catch (error) {
      console.error("Error creating clip:", error);
      return {
        success: false as const,
        error: error instanceof Error ? error.message : "An unexpected error occurred while creating the clip",
      };
    } finally {
      set({ isSubmittingClip: false });
    }
  },

  createMarker: async (description?: string) => {
    const { video, fetchEvents } = get();
    if (!video) return;

    const markerPromise = (async () => {
      const result = await createStreamMarker(description);
      if (result.success && result.data) {
        // Refetch events so the new marker appears on the timeline
        fetchEvents(video.id);
        return result.data;
      } else {
        throw new Error(result.error || "Failed to create marker");
      }
    })();

    toast.promise(markerPromise, {
      loading: "Creating marker...",
      success: "Marker created successfully!",
      error: (err) => err.message || "An unexpected error occurred while creating the marker",
    });

    await markerPromise;
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

  setIsSeekDisabled: (disabled) => set({ isSeekDisabled: disabled }),

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
export const useVideoPlayerVideo = () => useVideoPlayerStore((state) => state.video);
export const useVideoPlayerReady = () => useVideoPlayerStore((state) => state.isPlayerReady);
export const useVideoPlayerIsPlaying = () => useVideoPlayerStore((state) => state.isPlaying);
export const useVideoPlayerIsMuted = () => useVideoPlayerStore((state) => state.isMuted);
export const useVideoPlayerCurrentTime = () => useVideoPlayerStore((state) => state.currentTime);
export const useVideoPlayerEvents = () => useVideoPlayerStore((state) => state.events);
export const useVideoPlayerIsLoadingEvents = () => useVideoPlayerStore((state) => state.isLoadingEvents);
export const useVideoPlayerIsCreatingClip = () => useVideoPlayerStore((state) => state.isCreatingClip);
export const useVideoPlayerClipSelection = () =>
  useVideoPlayerStore((state) => ({
    startTime: state.clipStartTime,
    endTime: state.clipEndTime,
  }));
