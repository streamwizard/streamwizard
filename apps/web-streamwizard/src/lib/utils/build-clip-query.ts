import { ClipSearchParams } from "@/types/pages";

export default function buildClipQuery<T>(params: ClipSearchParams, query: T): T {
  const { game_id, creator_id, is_featured, end_date, start_date, search_query, page, sort, asc } = params;

  // Type assertion to access query builder methods while preserving the full type
  const q = query as T & {
    eq: (column: string, value: unknown) => T;
    gte: (column: string, value: unknown) => T;
    lte: (column: string, value: unknown) => T;
    ilike: (column: string, pattern: string) => T;
    order: (column: string, options?: { ascending: boolean }) => T;
    range: (from: number, to: number) => T;
  };

  let result: T = query;

  if (game_id) result = q.eq("game_id", game_id) as T;
  if (creator_id) result = q.eq("creator_id", creator_id) as T;
  if (is_featured !== undefined) result = q.eq("is_featured", is_featured) as T;
  if (start_date) result = q.gte("created_at_twitch", start_date) as T;
  if (end_date) result = q.lte("created_at_twitch", end_date) as T;
  if (search_query) result = q.ilike("title", `%${search_query}%`) as T;

  if (sort) {
    if (sort === "date") {
      result = (asc === "true" ? q.order("created_at_twitch", { ascending: true }) : q.order("created_at_twitch", { ascending: false })) as T;
    } else if (sort === "views") {
      result = (asc === "true" ? q.order("view_count", { ascending: true }) : q.order("view_count", { ascending: false })) as T;
    }
  } else {
    result = q.order("created_at_twitch", { ascending: false }) as T;
  }

  const pageIndex = page ? parseInt(page) : 1;
  const pageSize = 100;
  const from = (pageIndex - 1) * pageSize;
  const to = from + pageSize - 1;

  result = q.range(from, to) as T;

  return result;
}
