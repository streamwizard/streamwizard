import { Point } from "@influxdata/influxdb-client";
import { pushPoint } from "./influx-client";

export function trackSupabaseQuery(
  table: string,
  operation: "select" | "insert" | "update" | "delete" | "upsert",
  durationMs: number,
  success: boolean,
  service = "supabase",
): void {
  pushPoint(
    new Point("supabase_query")
      .tag("service", service)
      .tag("table", table)
      .tag("operation", operation)
      .tag("success", String(success))
      .floatField("duration_ms", durationMs),
  );
}

