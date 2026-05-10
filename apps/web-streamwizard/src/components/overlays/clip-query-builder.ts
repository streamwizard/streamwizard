import type { ClipsWidgetConfig, TimeWindowPreset } from "@/types/overlays";

export function getTimeWindowDates(
  timeWindow: TimeWindowPreset | "custom",
  customRange?: { start: string; end: string }
): { start?: string; end?: string } {
  if (timeWindow === "all") return {};

  if (timeWindow === "custom" && customRange) {
    return {
      start: customRange.start ? new Date(customRange.start).toISOString() : undefined,
      end: customRange.end ? new Date(customRange.end).toISOString() : undefined,
    };
  }

  const now = new Date();
  const daysMap: Record<string, number> = {
    last7d: 7,
    last30d: 30,
    last90d: 90,
    last365d: 365,
  };

  const days = daysMap[timeWindow];
  if (!days) return {};

  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { start: start.toISOString() };
}

export function buildOverlayClipQuery<T>(
  config: ClipsWidgetConfig,
  query: T,
  options?: { userId?: string }
): T {
  const q = query as T & {
    eq: (column: string, value: unknown) => T;
    gte: (column: string, value: unknown) => T;
    lte: (column: string, value: unknown) => T;
    in: (column: string, values: unknown[]) => T;
    order: (column: string, options?: { ascending: boolean }) => T;
    limit: (count: number) => T;
  };

  let result: T = query as T;

  if (options?.userId) {
    result = q.eq("user_id", options.userId) as T;
  }

  if (config.gameIds.length > 0) {
    result = (result as typeof q).in("game_id", config.gameIds) as T;
  }

  if (config.creatorIds.length > 0) {
    result = (result as typeof q).in("creator_id", config.creatorIds) as T;
  }

  if (config.isFeaturedOnly) {
    result = (result as typeof q).eq("is_featured", true) as T;
  }

  if (config.minViewCount > 0) {
    result = (result as typeof q).gte("view_count", config.minViewCount) as T;
  }

  const { start, end } = getTimeWindowDates(
    config.timeWindow,
    config.customDateRange
  );
  if (start) {
    result = (result as typeof q).gte("created_at_twitch", start) as T;
  }
  if (end) {
    result = (result as typeof q).lte("created_at_twitch", end) as T;
  }

  if (config.sort !== "random") {
    const sortMap: Record<string, { column: string; ascending: boolean }> = {
      newest: { column: "created_at_twitch", ascending: false },
      oldest: { column: "created_at_twitch", ascending: true },
      most_viewed: { column: "view_count", ascending: false },
      least_viewed: { column: "view_count", ascending: true },
    };
    const sortConfig = sortMap[config.sort];
    if (sortConfig) {
      result = (result as typeof q).order(sortConfig.column, {
        ascending: sortConfig.ascending,
      }) as T;
    }
  }

  result = (result as typeof q).limit(config.maxClips) as T;

  return result;
}
