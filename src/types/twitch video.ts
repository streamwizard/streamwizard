/**
 * Twitch Helix API Types
 * Based on: https://dev.twitch.tv/docs/api/reference
 */

// =============================================================================
// Video Types (GET /helix/videos)
// =============================================================================

/**
 * Represents a Twitch video (VOD) from the Helix API
 */
export interface TwitchVideo {
  /** Video ID */
  id: string;
  /** ID of the stream the video originated from (if applicable) */
  stream_id: string | null;
  /** ID of the user who owns the video */
  user_id: string;
  /** Login name of the user who owns the video */
  user_login: string;
  /** Display name of the user who owns the video */
  user_name: string;
  /** Video title */
  title: string;
  /** Video description */
  description: string;
  /** Date when the video was created (RFC3339 format) */
  created_at: string;
  /** Date when the video was published (RFC3339 format) */
  published_at: string;
  /** Video URL on Twitch */
  url: string;
  /**
   * Thumbnail URL template - replace %{width} and %{height} with actual dimensions
   * Example: https://static-cdn.jtvnw.net/cf_vods/.../%{width}x%{height}.jpg
   */
  thumbnail_url: string;
  /** Whether the video can be viewed */
  viewable: "public" | "private";
  /** Number of times the video has been viewed */
  view_count: number;
  /** Language of the video (ISO 639-1 two-letter code) */
  language: string;
  /** Type of video */
  type: "upload" | "archive" | "highlight";
  /** Duration of the video (format: "1h2m3s") */
  duration: string;
  /** IDs of muted segments (if any) */
  muted_segments: MutedSegment[] | null;

  is_live?: boolean;
}

/**
 * Represents a muted segment within a video
 */
export interface MutedSegment {
  /** Duration of the muted segment in seconds */
  duration: number;
  /** Offset in seconds from the start of the video */
  offset: number;
}

/**
 * Pagination cursor for Twitch API responses
 */
export interface TwitchPagination {
  /** Cursor value for the next page of results */
  cursor?: string;
}

/**
 * Response from GET /helix/videos
 */
export interface TwitchVideosResponse {
  data: TwitchVideo[];
  pagination: TwitchPagination;
}

// =============================================================================
// Clip Types (POST /helix/clips)
// =============================================================================

/**
 * Parameters for creating a clip
 */
export interface CreateClipParams {
  /** ID of the broadcaster */
  broadcaster_id: string;
  /** Whether the clip capture occurs after a delay (default: false) */
  has_delay?: boolean;
}

/**
 * Created clip data from POST /helix/clips
 */
export interface TwitchClip {
  /** URL for editing the clip */
  edit_url: string;
  /** ID of the created clip */
  id: string;
}

/**
 * Response from POST /helix/clips
 */
export interface TwitchClipsResponse {
  data: TwitchClip[];
}

// =============================================================================
// Delete Video Types (DELETE /helix/videos)
// =============================================================================

/**
 * Response from DELETE /helix/videos
 * Returns an array of video IDs that were successfully deleted
 */
export interface DeleteVideosResponse {
  data: string[];
}

// =============================================================================
// Stream Marker Types (GET /helix/streams/markers)
// =============================================================================

/**
 * A single stream marker
 */
export interface TwitchStreamMarker {
  /** Marker ID */
  id: string;
  /** UTC date and time (RFC3339) when the marker was created */
  created_at: string;
  /** Description the user gave the marker */
  description: string;
  /** Offset in seconds from the beginning of the stream */
  position_seconds: number;
  /** URL that opens the video in Twitch Highlighter */
  url: string;
}

/**
 * Response from GET /helix/streams/markers
 */
export interface TwitchStreamMarkersResponse {
  data: {
    user_id: string;
    user_name: string;
    user_login: string;
    videos: {
      video_id: string;
      markers: TwitchStreamMarker[];
    }[];
  }[];
  pagination: TwitchPagination;
}

/**
 * Result of fetching stream markers
 */
export interface GetStreamMarkersResult {
  success: boolean;
  markers?: TwitchStreamMarker[];
  error?: string;
}

/**
 * Response from POST /helix/streams/markers (Create Stream Marker)
 */
export interface CreateStreamMarkerResponse {
  data: {
    id: string;
    created_at: string;
    position_seconds: number;
    description: string;
  }[];
}

// =============================================================================
// App-specific Types
// =============================================================================

/**
 * Result of a delete videos operation
 */
export interface DeleteVideosResult {
  success: boolean;
  deletedIds?: string[];
  error?: string;
}

/**
 * Result of fetching videos
 */
export interface GetVideosResult {
  success: boolean;
  videos?: TwitchVideo[];
  cursor?: string;
  error?: string;
}

/**
 * Parameters for creating a clip from a VOD
 */
export interface CreateClipFromVodParams {
  /** ID of the VOD */
  video_id: string;
  /** Offset in seconds from the start of the VOD */
  offset: number;
  /** Title for the clip */
  title?: string;
}

/**
 * Result of creating a clip
 */
export interface CreateClipResult {
  editUrl?: string;
  clipId?: string;
}

/**
 * Helper function to format a video thumbnail URL with specific dimensions
 */
export function formatThumbnailUrl(thumbnailUrl: string, width: number, height: number): string {
  return thumbnailUrl.replace("%{width}", width.toString()).replace("%{height}", height.toString());
}

/**
 * Helper function to parse Twitch duration format (e.g., "1h2m3s") to seconds
 */
export function parseDuration(duration: string): number {
  const regex = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/;
  const match = duration.match(regex);

  if (!match) return 0;

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Helper function to format seconds to human-readable duration
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}
