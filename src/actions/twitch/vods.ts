"use server";

import { TwitchAPI } from "@/lib/axios/twitch-api";
import { createClient } from "@/lib/supabase/server";
import {
  CreateClipResponse,
  DeleteVideosResponse,
  GetVideosResponse,
  TwitchVideo,
  TwitchVideoType,
} from "@/types/twitch";
import { AxiosError } from "axios";

interface ActionResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

/**
 * Get videos for the authenticated user
 */
export async function getVideos(options?: {
  cursor?: string;
  first?: number;
  type?: TwitchVideoType;
}): Promise<ActionResponse<{ videos: TwitchVideo[]; cursor?: string }>> {
  const supabase = await createClient();

  const { data: integration, error: dbError } = await supabase
    .from("integrations_twitch")
    .select("twitch_user_id")
    .single();

  if (dbError || !integration?.twitch_user_id) {
    return {
      success: false,
      message: "Twitch integration not found",
    };
  }

  try {
    const response = await TwitchAPI.get<GetVideosResponse>("/videos", {
      params: {
        user_id: integration.twitch_user_id,
        type: options?.type ?? "archive",
        first: options?.first ?? 20,
        after: options?.cursor,
      },
      broadcasterID: integration.twitch_user_id,
    });

    return {
      success: true,
      message: "Videos fetched successfully",
      data: {
        videos: response.data.data,
        cursor: response.data.pagination?.cursor,
      },
    };
  } catch (error) {
    console.error("Error fetching videos:", error);
    const message =
      error instanceof AxiosError
        ? error.response?.data?.message || error.message
        : "Failed to fetch videos";
    return {
      success: false,
      message,
    };
  }
}

/**
 * Delete videos by ID
 * Max 5 IDs per request as per Twitch API limits
 */
export async function deleteVideos(
  videoIds: string[]
): Promise<ActionResponse<{ deletedIds: string[] }>> {
  if (videoIds.length === 0) {
    return {
      success: false,
      message: "No video IDs provided",
    };
  }

  if (videoIds.length > 5) {
    return {
      success: false,
      message: "Maximum 5 videos can be deleted at once",
    };
  }

  const supabase = await createClient();

  const { data: integration, error: dbError } = await supabase
    .from("integrations_twitch")
    .select("twitch_user_id")
    .single();

  if (dbError || !integration?.twitch_user_id) {
    return {
      success: false,
      message: "Twitch integration not found",
    };
  }

  try {
    // Build query params with multiple id parameters
    const params = new URLSearchParams();
    videoIds.forEach((id) => params.append("id", id));

    const response = await TwitchAPI.delete<DeleteVideosResponse>(
      `/videos?${params.toString()}`,
      {
        broadcasterID: integration.twitch_user_id,
      }
    );

    return {
      success: true,
      message: `Successfully deleted ${response.data.data.length} video(s)`,
      data: {
        deletedIds: response.data.data,
      },
    };
  } catch (error) {
    console.error("Error deleting videos:", error);
    const message =
      error instanceof AxiosError
        ? error.response?.data?.message || error.message
        : "Failed to delete videos";
    return {
      success: false,
      message,
    };
  }
}

/**
 * Create a clip from a VOD using the Twitch API
 * POST /helix/videos/clips
 * 
 * @param vodId - The VOD ID to create clip from
 * @param vodOffset - Where the clip ends (clip starts at vodOffset - duration)
 * @param duration - Clip duration in seconds (5-60, default 30)
 * @param title - Optional clip title
 */
export async function createClipFromVod(options: {
  vodId: string;
  vodOffset: number;
  duration?: number;
  title?: string;
}): Promise<ActionResponse<{ id: string; editUrl: string }>> {
  const { vodId, vodOffset, duration = 30, title } = options;

  // Validate duration (5-60 seconds)
  if (duration < 5 || duration > 60) {
    return {
      success: false,
      message: "Duration must be between 5 and 60 seconds",
    };
  }

  // vod_offset must be >= duration
  if (vodOffset < duration) {
    return {
      success: false,
      message: "VOD offset must be greater than or equal to clip duration",
    };
  }

  const supabase = await createClient();

  const { data: integration, error: dbError } = await supabase
    .from("integrations_twitch")
    .select("twitch_user_id")
    .single();

  if (dbError || !integration?.twitch_user_id) {
    return {
      success: false,
      message: "Twitch integration not found",
    };
  }

  try {
    // Build query params for the VOD clips endpoint
    const params: Record<string, string | number> = {
      broadcaster_id: integration.twitch_user_id,
      editor_id: integration.twitch_user_id,
      vod_id: vodId,
      vod_offset: vodOffset,
      duration: duration,
    };

    if (title) {
      params.title = title;
    }

    const response = await TwitchAPI.post<CreateClipResponse>(
      "/videos/clips",
      null,
      {
        params,
        broadcasterID: integration.twitch_user_id,
      }
    );

    if (response.data.data.length === 0) {
      return {
        success: false,
        message: "No clip was created",
      };
    }

    const clip = response.data.data[0];

    return {
      success: true,
      message: "Clip created successfully",
      data: {
        id: clip.id,
        editUrl: clip.edit_url,
      },
    };
  } catch (error) {
    console.error("Error creating clip:", error);
    const message =
      error instanceof AxiosError
        ? error.response?.data?.message || error.message
        : "Failed to create clip";
    return {
      success: false,
      message,
    };
  }
}

