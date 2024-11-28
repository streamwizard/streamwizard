import { createClient } from "@/lib/supabase/server";

export async function fetchClips(searchParams: { [key: string]: string | undefined }) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  // Your existing query logic here
  const { game_id, creator_id, is_featured, end_date, start_date, search_query, page, broadcaster_id, sort, asc } = searchParams;

  let query = supabase.from("clips").select("*", { count: "exact" }).limit(100);

  // Apply filters
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

  // if there is a broadcaster_id, add it to the query otherwise use the broadcaster_id from the user
  query = broadcaster_id ? query.eq("broadcaster_id", broadcaster_id) : query.eq("user_id", user?.user?.id!);

  const pageIndex = page ? parseInt(page) : 1;
  const pageSize = 100;
  const from = (pageIndex - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query.range(from, to);

  let { data, error, count } = await query;

  if (error) {
    console.error(error);
    return null;
  }

  return {
    data,
    count: count || 0,
    pageIndex,
    pageSize,
  };
}
