"use server";

/**
 * Server Actions for Twitch Helix API
 * All API calls are made server-side to protect credentials
 */

import { TwitchAPI } from "@/lib/axios/twitch-api";
import { createClient } from "@/lib/supabase/server";
import type {
  TwitchVideo,
  GetVideosResponse,
  CreateClipResponse,
  DeleteVideosResponse,
  GetGamesResponse,
} from "@/types/twitch";
import type {
  GetVideosResult,
  DeleteVideosResult,
  CreateClipResult,
  TwitchStreamMarkersResponse,
  GetStreamMarkersResult,
  CreateStreamMarkerResponse,
} from "@/types/twitch video";
import type { GetStreamDataResult } from "@/types/stream-events";
import { ActionResponse } from "@/types/actions";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the broadcaster ID from Supabase
 * @returns The broadcaster's Twitch user ID
 */
async function getBroadcasterId(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("integrations_twitch")
    .select("twitch_user_id")
    .single();

  if (error || !data?.twitch_user_id) {
    throw new Error("Failed to fetch broadcaster ID from database");
  }

  return data.twitch_user_id;
}

async function getCurrentStreamDetails(
  broadcaster_id: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("broadcaster_live_status")
    .select("is_live, stream_id")
    .eq("broadcaster_id", broadcaster_id)
    .single();

  if (error) return null;

  if (!data.is_live) return null;

  return data.stream_id;
}

// =============================================================================
// Get Videos
// =============================================================================

/**
 * Fetch VODs for the configured user
 *
 * @param cursor - Optional pagination cursor for fetching next page
 * @returns GetVideosResult with videos array and next cursor
 *
 * API: GET https://api.twitch.tv/helix/videos
 * Docs: https://dev.twitch.tv/docs/api/reference/#get-videos
 */

export async function getVideos(cursor?: string): Promise<GetVideosResult> {
  try {
    const broadcasterId = await getBroadcasterId();
    const streamId = await getCurrentStreamDetails(broadcasterId);

    const response = await TwitchAPI.get<GetVideosResponse>("/videos", {
      broadcasterID: broadcasterId,
      params: {
        user_id: broadcasterId,
        type: "archive",
        first: 100,
        ...(cursor && { after: cursor }),
      },
    });

    const videos = response.data.data.map((video) => {
      return {
        ...video,
        is_live: streamId === video.stream_id,
      };
    });

    return {
      success: true,
      videos: videos,
      cursor: response.data.pagination?.cursor,
    };
  } catch (error) {
    console.error("Error fetching videos:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error fetching videos",
    };
  }
}

// =============================================================================
// Delete Videos
// =============================================================================

/**
 * Delete one or more videos
 *
 * @param videoIds - Array of video IDs to delete (max 5 per request)
 * @returns DeleteVideosResult with success status and deleted IDs
 *
 * API: DELETE https://api.twitch.tv/helix/videos
 * Docs: https://dev.twitch.tv/docs/api/reference/#delete-videos
 *
 * Requires scope: channel:manage:videos
 * Note: If any deletion fails, no videos are deleted (atomic operation)
 */
export async function deleteVideos(
  videoIds: string[],
): Promise<DeleteVideosResult> {
  try {
    // Validate input
    if (!videoIds || videoIds.length === 0) {
      return {
        success: false,
        error: "No video IDs provided",
      };
    }

    if (videoIds.length > 5) {
      return {
        success: false,
        error: "Maximum 5 videos can be deleted per request",
      };
    }

    const broadcasterId = await getBroadcasterId();

    // Build query string with multiple id parameters
    const params = new URLSearchParams();
    videoIds.forEach((id) => params.append("id", id));

    const response = await TwitchAPI.delete<DeleteVideosResponse>(
      `/videos?${params}`,
      {
        broadcasterID: broadcasterId,
      },
    );

    return {
      success: true,
      deletedIds: response.data.data,
    };
  } catch (error) {
    console.error("Error deleting videos:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error deleting videos",
    };
  }
}

// =============================================================================
// Create Clip From vod
// =============================================================================

interface CreateClipFromVODProps {
  vodId: string;
  vod_offset: number;
  duration: number;
  title?: string;
}

/**
 * Create a clip from a broadcaster's VOD
 *
 * The clip will start at (vod_offset - duration) and end at vod_offset.
 * Duration must be between 5-60 seconds, and vod_offset must be >= duration.
 *
 * API: POST https://api.twitch.tv/helix/videos/clips (BETA)
 * Requires scope: editor:manage:clips or channel:manage:clips
 */
export async function createClipFromVOD({
  vodId,
  vod_offset,
  duration,
  title,
}: CreateClipFromVODProps): Promise<ActionResponse<CreateClipResult>> {
  try {
    const broadcasterId = await getBroadcasterId();

    if (!broadcasterId) {
      return {
        success: false,
        error: "Failed to get broadcaster ID",
      };
    }

    // Validate duration (5-60 seconds)
    if (duration < 5 || duration > 60) {
      return {
        success: false,
        error: "Duration must be between 5 and 60 seconds",
      };
    }

    // Validate vod_offset must be >= duration
    if (vod_offset < duration) {
      return {
        success: false,
        error: `vod_offset (${vod_offset}) must be greater than or equal to duration (${duration})`,
      };
    }

    const response = await TwitchAPI.post<CreateClipResponse>(
      "/videos/clips",
      null,
      {
        params: {
          editor_id: broadcasterId,
          broadcaster_id: broadcasterId,
          vod_id: vodId,
          vod_offset: vod_offset,
          duration: duration,
          title: title || "Clip from VOD",
        },
        broadcasterID: broadcasterId,
      },
    );

    if (!response.data.data || response.data.data.length === 0) {
      return {
        success: false,
        error: "No clip data returned from API",
      };
    }

    const clip = response.data.data[0];

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
      error:
        error instanceof Error
          ? error.message
          : "Unknown error creating clip from VOD",
    };
  }
}

// =============================================================================
// Get Single Video (for video details)
// =============================================================================

/**
 * Fetch a single video by ID
 *
 * @param videoId - The video ID to fetch
 * @returns The video object or null if not found
 */
export async function getVideo(videoId: string): Promise<TwitchVideo | null> {
  try {
    const broadcasterId = await getBroadcasterId();

    const response = await TwitchAPI.get<GetVideosResponse>("/videos", {
      broadcasterID: broadcasterId,
      params: {
        id: videoId,
      },
    });

    if (!response.data.data || response.data.data.length === 0) {
      return null;
    }

    return response.data.data[0];
  } catch (error) {
    console.error("Error fetching video:", error);
    return null;
  }
}

// =============================================================================
// Get Stream Data (Events + Clips) from Supabase
// =============================================================================

/**
 * Fetch stream events and clips from Supabase by video_id
 * Uses the get_stream_data RPC function which joins through the vods table
 *
 * @param videoId - The Twitch video ID (VOD ID)
 * @returns GetStreamDataResult with events and clips arrays
 */
export async function getStreamData(
  videoId: string,
): Promise<GetStreamDataResult> {
  try {
    if (!videoId) {
      return {
        success: false,
        error: "No video ID provided",
      };
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc("get_stream_data", {
      p_video_id: videoId,
    });

    if (error) {
      console.error("Supabase error:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    const result = data as { stream_events: any[]; clips: any[] };


    

    return {
      success: true,
      events: result.stream_events ?? [],
      clips: result.clips ?? [],
    };
  } catch (error) {
    console.error("Error fetching stream data:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error fetching stream data",
    };
  }
}

// =============================================================================
// Get Stream Markers from Twitch
// =============================================================================

/**
 * Fetch stream markers for a specific VOD from the Twitch API
 *
 * @param videoId - The Twitch video ID (VOD ID)
 * @returns GetStreamMarkersResult with markers array
 *
 * API: GET https://api.twitch.tv/helix/streams/markers
 * Docs: https://dev.twitch.tv/docs/api/reference/#get-stream-markers
 *
 * Requires scope: user:read:broadcast or channel:manage:broadcast
 */
export async function getStreamMarkers(
  videoId: string,
): Promise<GetStreamMarkersResult> {
  try {
    if (!videoId) {
      return {
        success: false,
        error: "No video ID provided",
      };
    }

    const broadcasterId = await getBroadcasterId();

    const allMarkers: TwitchStreamMarkersResponse["data"][0]["videos"][0]["markers"] =
      [];
    let cursor: string | undefined;

    // Paginate through all markers
    do {
      const response = await TwitchAPI.get<TwitchStreamMarkersResponse>(
        "/streams/markers",
        {
          broadcasterID: broadcasterId,
          params: {
            video_id: videoId,
            first: 100,
            ...(cursor && { after: cursor }),
          },
        },
      );

      const data = response.data.data;
      if (data && data.length > 0) {
        for (const user of data) {
          for (const video of user.videos) {
            allMarkers.push(...video.markers);
          }
        }
      }

      cursor = response.data.pagination?.cursor;
    } while (cursor);

    return {
      success: true,
      markers: allMarkers,
    };
  } catch (error) {
    console.error("Error fetching stream markers:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error fetching stream markers",
    };
  }
}

// =============================================================================
// Create Stream Marker
// =============================================================================

/**
 * Create a stream marker on a live stream
 *
 * @param description - Optional short description (max 140 characters)
 * @returns ActionResponse with marker data
 *
 * API: POST https://api.twitch.tv/helix/streams/markers
 * Docs: https://dev.twitch.tv/docs/api/reference/#create-stream-marker
 *
 * Requires scope: channel:manage:broadcast
 * Note: The stream must be live and have VOD enabled
 */
export async function createStreamMarker(
  description?: string,
): Promise<
  ActionResponse<{ id: string; position_seconds: number; description: string }>
> {
  try {
    const broadcasterId = await getBroadcasterId();

    if (description && description.length > 140) {
      return {
        success: false,
        error: "Description must be 140 characters or less",
      };
    }

    const response = await TwitchAPI.post<CreateStreamMarkerResponse>(
      "/streams/markers",
      {
        user_id: broadcasterId,
        ...(description && { description }),
      },
      {
        broadcasterID: broadcasterId,
      },
    );

    if (!response.data.data || response.data.data.length === 0) {
      return {
        success: false,
        error: "No marker data returned from API",
      };
    }

    const marker = response.data.data[0];

    return {
      success: true,
      data: {
        id: marker.id,
        position_seconds: marker.position_seconds,
        description: marker.description,
      },
    };
  } catch (error) {
    console.error("Error creating stream marker:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error creating stream marker",
    };
  }
}
