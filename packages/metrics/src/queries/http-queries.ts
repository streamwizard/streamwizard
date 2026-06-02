import { runFluxQuery } from "../query-client";

export interface HttpRequestPoint {
  time: string;
  service: string;
  method: string;
  route: string;
  status: string;
  durationMs: number;
}

export interface HttpErrorRatePoint {
  time: string;
  total: number;
  errors: number;
  errorRate: number;
}

export interface HttpRouteStatPoint {
  route: string;
  method: string;
  requestCount: number;
  avgDurationMs: number;
}

export async function queryHttpRequests(fluxRange = "24h", window = "1h"): Promise<HttpRequestPoint[]> {
  const bucket = process.env.INFLUXDB_BUCKET ?? "streamwizard";
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "http_request")
      |> filter(fn: (r) => r._field == "duration_ms")
      |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
      |> yield(name: "http_requests")
  `;
  return runFluxQuery(query, (row) => ({
    time: row._time ?? "",
    service: row.service ?? "unknown",
    method: row.method ?? "unknown",
    route: row.route ?? "unknown",
    status: row.status ?? "unknown",
    durationMs: Number(row._value),
  }));
}

export async function queryHttpRequestCount(fluxRange = "24h"): Promise<{ time: string; count: number; status: string }[]> {
  const bucket = process.env.INFLUXDB_BUCKET ?? "streamwizard";
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "http_request")
      |> filter(fn: (r) => r._field == "duration_ms")
      |> aggregateWindow(every: 1h, fn: count, createEmpty: false)
      |> yield(name: "http_count")
  `;
  return runFluxQuery(query, (row) => ({
    time: row._time ?? "",
    count: Number(row._value),
    status: row.status ?? "unknown",
  }));
}

export async function queryHttpRouteStats(fluxRange = "24h"): Promise<HttpRouteStatPoint[]> {
  const bucket = process.env.INFLUXDB_BUCKET ?? "streamwizard";
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "http_request")
      |> filter(fn: (r) => r._field == "duration_ms")
      |> group(columns: ["route", "method"])
      |> reduce(
          identity: {count: 0, totalDuration: 0.0},
          fn: (r, accumulator) => ({
            count: accumulator.count + 1,
            totalDuration: accumulator.totalDuration + r._value
          })
        )
      |> map(fn: (r) => ({ r with avgDuration: r.totalDuration / float(v: r.count) }))
      |> yield(name: "route_stats")
  `;
  return runFluxQuery(query, (row) => ({
    route: row.route ?? "unknown",
    method: row.method ?? "unknown",
    requestCount: Number(row.count),
    avgDurationMs: Number(row.avgDuration),
  }));
}
