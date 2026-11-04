"use server";

import { TwitchApi } from "@repo/twitch-api";
import { describeError } from "@repo/sentry/safe-error";
import { getCurrentStreamDetails as _getCurrentStreamDetails, getStreamData as _getStreamData, createPendingClip } from "@repo/supabase/queries/vods";
import type { TwitchVideo, GetVideosResponse } from "@/types/twitch";
import type { GetVideosResult, DeleteVideosResult, CreateClipResult, TwitchStreamMarkersResponse, GetStreamMarkersResult, CreateStreamMarkerResponse } from "@/types/twitch-video";
import type { GetStreamDataResult, StreamEvent, Clip } from "@/types/stream-events";
import { ActionResponse } from "@/types/actions";
import { track } from "@/lib/track";
import { tryAuthContext } from "@/lib/auth";
import { twitchIdSchema } from "@/schemas/ids";
import {
  createClipFromVodSchema,
  deleteVideosSchema,
  streamMarkerDescriptionSchema,
  twitchCursorSchema,
} from "@/schemas/twitch";

const UNAUTHORIZED = { success: false, error: "Unauthorized" } as const;

// =============================================================================
// Get Videos
// =============================================================================

export async function getVideos(cursor?: string): Promise<GetVideosResult> {
  const ctx = await tryAuthContext();
  if (!ctx) return UNAUTHORIZED;
  const parsedCursor = twitchCursorSchema.optional().safeParse(cursor);
  if (!parsedCursor.success) return { success: false, error: "Invalid page cursor" };
  const after = parsedCursor.data;

  try {
    const { broadcasterId, supabase } = ctx;
    const streamId = await _getCurrentStreamDetails(supabase, broadcasterId);

    const api = new TwitchApi(broadcasterId);
    const response = await api.videos.getVods({
      user_id: broadcasterId,
      type: "archive",
      first: 100,
      ...(after && { after }),
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
    console.error(`[vods] get videos failed: ${describeError(error)}`);
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
  const ctx = await tryAuthContext();
  if (!ctx) return UNAUTHORIZED;
  const parsed = deleteVideosSchema.safeParse(videoIds);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid video IDs" };

  try {
    // Helix only deletes videos the token's owner may delete.
    const api = new TwitchApi(ctx.broadcasterId);
    const deletedIds = await api.videos.deleteVods(parsed.data);

    return { success: true, deletedIds };
  } catch (error) {
    console.error(`[vods] delete videos failed: ${describeError(error)}`);
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

export async function createClipFromVOD(input: CreateClipFromVODProps): Promise<ActionResponse<CreateClipResult>> {
  const ctx = await tryAuthContext();
  if (!ctx) return UNAUTHORIZED;
  const parsed = createClipFromVodSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid clip" };
  const { vodId, vod_offset, duration, title } = parsed.data;

  try {
    const { broadcasterId, supabase } = ctx;
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

    await track("vod_clip_created", { duration_s: duration }, ctx.user);

    return {
      success: true,
      data: {
        editUrl: clip.edit_url,
        clipId: clip.id,
      },
    };
  } catch (error) {
    console.error(`[vods] create clip from VOD failed: ${describeError(error)}`);
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
  const ctx = await tryAuthContext();
  if (!ctx) return null;
  const parsed = twitchIdSchema.safeParse(videoId);
  if (!parsed.success) return null;

  try {
    const api = new TwitchApi(ctx.broadcasterId);
    const vod = await api.videos.getVodById(parsed.data);
    return (vod as TwitchVideo | undefined) ?? null;
  } catch (error) {
    console.error(`[vods] get video failed: ${describeError(error)}`);
    return null;
  }
}

// =============================================================================
// Get Stream Data (Events + Clips) from Supabase
// =============================================================================

/** get_stream_data is security invoker, so RLS on stream_events and clips limits it to the caller's own rows. */
export async function getStreamData(videoId: string): Promise<GetStreamDataResult> {
  const ctx = await tryAuthContext();
  if (!ctx) return UNAUTHORIZED;
  const parsed = twitchIdSchema.safeParse(videoId);
  if (!parsed.success) return { success: false, error: "No video ID provided" };

  try {
    const { events, clips } = await _getStreamData(ctx.supabase, parsed.data);

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
  const ctx = await tryAuthContext();
  if (!ctx) return UNAUTHORIZED;
  const parsed = twitchIdSchema.safeParse(videoId);
  if (!parsed.success) return { success: false, error: "No video ID provided" };

  try {
    const api = new TwitchApi(ctx.broadcasterId);

    const allMarkers: TwitchStreamMarkersResponse["data"][0]["videos"][0]["markers"] = [];
    let cursor: string | undefined;

    do {
      const response = await api.markers.getMarkers({
        video_id: parsed.data,
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
    console.error(`[vods] get stream markers failed: ${describeError(error)}`);
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
  const ctx = await tryAuthContext();
  if (!ctx) return UNAUTHORIZED;
  const parsed = streamMarkerDescriptionSchema.safeParse(description);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid description" };

  try {
    const api = new TwitchApi(ctx.broadcasterId);
    const marker = await api.markers.createMarker(parsed.data);
    await track("stream_marker_created", {}, ctx.user);

    return {
      success: true,
      data: {
        id: marker.id,
        position_seconds: marker.position,
        description: marker.description,
      },
    };
  } catch (error) {
    console.error(`[vods] create stream marker failed: ${describeError(error)}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error creating stream marker",
    };
  }
}
