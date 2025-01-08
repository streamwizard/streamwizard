import { ClipSearchParams } from "@/types/pages";

export default function buildClipQuery(params: ClipSearchParams, query: any) {
  const { game_id, creator_id, is_featured, end_date, start_date, search_query, page, sort, asc } = params;

  if (game_id) query = query.eq("game_id", game_id);
  if (creator_id) query = query.eq("creator_id", creator_id);
  if (is_featured !== undefined) query = query.eq("is_featured", is_featured);
  if (start_date) query = query.gte("created_at_twitch", start_date);
  if (end_date) query = query.lte("created_at_twitch", end_date);
  if (search_query) query = query.ilike("title", `%${search_query}%`);

  if (sort) {
    if (sort === "date") {
      query = asc === "true" ? query.order("created_at_twitch", { ascending: true }) : query.order("created_at_twitch", { ascending: false });
    } else if (sort === "views") {
      query = asc === "true" ? query.order("view_count", { ascending: true }) : query.order("view_count", { ascending: false });
    }
  } else {
    query = query.order("created_at_twitch", { ascending: false });
  }

  const pageIndex = page ? parseInt(page) : 1;
  const pageSize = 100;
  const from = (pageIndex - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query.range(from, to);

  return query;
}
