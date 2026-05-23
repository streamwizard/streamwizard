import { trackSupabaseQuery } from "@repo/metrics";

export function withMetrics<TArgs extends unknown[], TResult extends { error: unknown }>(
  table: string,
  operation: "select" | "insert" | "update" | "delete" | "upsert",
  fn: (...args: TArgs) => Promise<TResult>,
  service = "supabase",
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    const start = performance.now();
    const result = await fn(...args);
    trackSupabaseQuery(table, operation, performance.now() - start, !result.error, service);
    return result;
  };
}
