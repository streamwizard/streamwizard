/**
 * PostgREST's per-request row cap: `max_rows` in supabase/config.toml, and the
 * hosted default too. A response past it is cut off without an error.
 */
export const POSTGREST_MAX_ROWS = 1000;

/** The part of a PostgREST response this helper reads. */
interface PageResult<T> {
  data: T[] | null;
  error: unknown;
}

/**
 * Reads every row of a query, one `.range(from, to)` page at a time, until a
 * page comes back short. For reads whose result feeds a total, a roll-up or a
 * "latest per X", where one `select` would silently stop at max_rows.
 *
 * `page` must order by something unique (add `id` as a tie-breaker), or rows
 * can repeat or go missing between pages. `pageSize` must not exceed
 * max_rows, or a full page reads as a short one and the loop stops early.
 *
 * Throws on a failed page: a partial result that looks complete is worse
 * than none.
 */
export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize: number = POSTGREST_MAX_ROWS,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    if (!data) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}
