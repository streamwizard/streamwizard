"use server";

import { TwitchApi } from "@repo/twitch-api";
import { createClient } from "@repo/supabase/next/server";
import { getBroadcasterId as _getBroadcasterId } from "@repo/supabase/queries/user";
import { getCurrentStreamDetails as _getCurrentStreamDetails, getStreamData as _getStreamData, createPendingClip } from "@repo/supabase/queries/vods";
import type { TwitchVideo, GetVideosResponse } from "@/types/twitch";
import type { GetVideosResult, DeleteVideosResult, CreateClipResult, TwitchStreamMarkersResponse, GetStreamMarkersResult, CreateStreamMarkerResponse } from "@/types/twitch-video";
import type { GetStreamDataResult, StreamEvent, Clip } from "@/types/stream-events";
import { ActionResponse } from "@/types/actions";

async function getBroadcasterId(): Promise<string> {
  const supabase = await createClient();
  return _getBroadcasterId(supabase);
}

// =============================================================================
// Get Videos
// =============================================================================

export async function getVideos(cursor?: string): Promise<GetVideosResult> {
  try {
    const broadcasterId = await getBroadcasterId();
    const supabase = await createClient();
    const streamId = await _getCurrentStreamDetails(supabase, broadcasterId);

    const api = new TwitchApi(broadcasterId);
    const response = await api.videos.getVods({
      user_id: broadcasterId,
      type: "archive",
      first: 100,
      ...(cursor && { after: cursor }),
    });

    const videos = response.data.map((video) => ({
      ...video,
      is_live: streamId === video.stream_id,
    })) as unknown as TwitchVideo[];

    return {
      success: true,
      videos,
      cursor: response.pagination?.cursor,
    };
  } catch (error) {
    console.error("Error fetching videos:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error fetching videos",
    };
  }
}

// =============================================================================
// Delete Videos
// =============================================================================

export async function deleteVideos(videoIds: string[]): Promise<DeleteVideosResult> {
  try {
    if (!videoIds || videoIds.length === 0) {
      return { success: false, error: "No video IDs provided" };
    }
    if (videoIds.length > 5) {
      return { success: false, error: "Maximum 5 videos can be deleted per request" };
    }

    const broadcasterId = await getBroadcasterId();
    const api = new TwitchApi(broadcasterId);
    const deletedIds = await api.videos.deleteVods(videoIds);

    return { success: true, deletedIds };
  } catch (error) {
    console.error("Error deleting videos:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error deleting videos",
    };
  }
}

// =============================================================================
// Create Clip From VOD
// =============================================================================

interface CreateClipFromVODProps {
  vodId: string;
  vod_offset: number;
  duration: number;
  title?: string;
}

export async function createClipFromVOD({ vodId, vod_offset, duration, title }: CreateClipFromVODProps): Promise<ActionResponse<CreateClipResult>> {
  try {
    if (duration < 5 || duration > 60) {
      return { success: false, error: "Duration must be between 5 and 60 seconds" };
    }
    if (vod_offset < duration) {
      return { success: false, error: `vod_offset (${vod_offset}) must be greater than or equal to duration (${duration})` };
    }

    const broadcasterId = await getBroadcasterId();
    const supabase = await createClient();
    const api = new TwitchApi(broadcasterId);

    const response = await api.clips.createClipFromVod({
      vod_id: vodId,
      vod_offset,
      duration,
      title: title || "Clip from VOD",
    });

    if (!response.data || response.data.length === 0) {
      return { success: false, error: "No clip data returned from API" };
    }

    const clip = response.data[0];

    try {
      await createPendingClip(supabase, clip.id, broadcasterId);
    } catch {
      return { success: false, error: "Clip created but not added to pending clips table" };
    }

    return {
      success: true,
      data: {
        editUrl: clip.edit_url,
        clipId: clip.id,
      },
    };
  } catch (error) {
    console.error("Error creating clip from VOD:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error creating clip from VOD",
    };
  }
}

// =============================================================================
// Get Single Video
// =============================================================================

export async function getVideo(videoId: string): Promise<TwitchVideo | null> {
  try {
    const broadcasterId = await getBroadcasterId();
    const api = new TwitchApi(broadcasterId);
    const vod = await api.videos.getVodById(videoId);
    return (vod as TwitchVideo | undefined) ?? null;
  } catch (error) {
    console.error("Error fetching video:", error);
    return null;
  }
}

// =============================================================================
// Get Stream Data (Events + Clips) from Supabase
// =============================================================================

export async function getStreamData(videoId: string): Promise<GetStreamDataResult> {
  try {
    if (!videoId) {
      return { success: false, error: "No video ID provided" };
    }

    const supabase = await createClient();
    const { events, clips } = await _getStreamData(supabase, videoId);

    return { success: true, events: events as StreamEvent[], clips: clips as Clip[] };
  } catch (error) {
    console.error("Error fetching stream data:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error fetching stream data",
    };
  }
}

// =============================================================================
// Get Stream Markers from Twitch
// =============================================================================

export async function getStreamMarkers(videoId: string): Promise<GetStreamMarkersResult> {
  try {
    if (!videoId) {
      return { success: false, error: "No video ID provided" };
    }

    const broadcasterId = await getBroadcasterId();
    const api = new TwitchApi(broadcasterId);

    const allMarkers: TwitchStreamMarkersResponse["data"][0]["videos"][0]["markers"] = [];
    let cursor: string | undefined;

    do {
      const response = await api.markers.getMarkers({
        video_id: videoId,
        first: 100,
        ...(cursor && { after: cursor }),
      }) as unknown as { data: TwitchStreamMarkersResponse["data"]; pagination?: { cursor?: string } };

      if (response.data && response.data.length > 0) {
        for (const user of response.data) {
          for (const video of user.videos) {
            allMarkers.push(...video.markers);
          }
        }
      }

      cursor = response.pagination?.cursor;
    } while (cursor);

    return { success: true, markers: allMarkers };
  } catch (error) {
    console.error("Error fetching stream markers:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error fetching stream markers",
    };
  }
}

// =============================================================================
// Create Stream Marker
// =============================================================================

export async function createStreamMarker(description?: string): Promise<ActionResponse<{ id: string; position_seconds: number; description: string }>> {
  try {
    if (description && description.length > 140) {
      return { success: false, error: "Description must be 140 characters or less" };
    }

    const broadcasterId = await getBroadcasterId();
    const api = new TwitchApi(broadcasterId);
    const marker = await api.markers.createMarker(description);

    return {
      success: true,
      data: {
        id: marker.id,
        position_seconds: marker.position,
        description: marker.description,
      },
    };
  } catch (error) {
    console.error("Error creating stream marker:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error creating stream marker",
    };
  }
}
