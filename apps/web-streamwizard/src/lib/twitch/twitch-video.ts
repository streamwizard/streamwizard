/**
 * Format a Twitch video thumbnail URL template with specific dimensions
 */
export function formatThumbnailUrl(thumbnailUrl: string, width: number, height: number): string {
  return thumbnailUrl.replace("%{width}", width.toString()).replace("%{height}", height.toString());
}

/**
 * Parse Twitch duration format (e.g., "1h2m3s") to seconds
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
