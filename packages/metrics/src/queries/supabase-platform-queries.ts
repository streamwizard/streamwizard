import { runFluxQuery, assertValidFluxDuration } from "../query-client";
import { resolveBucket, type QueryOpts } from "./query-opts";

// Supabase platform metrics, scraped from the per-project privileged
// Prometheus endpoint by Telegraf on the monitoring host. The prometheus
// parser writes every metric
// into a single measurement named "prometheus" with the metric name as the
// field key — so unlike the app metrics, everything here filters on _field.
//
// Counter fields (*_seconds_total, *_blks_*_total) need a derivative before
// they mean anything; gauge fields are used as-is.

export interface PlatformPoint {
  time: string;
  value: number;
}

const point = (row: Record<string, string | undefined>): PlatformPoint => ({
  time: row._time ?? "",
  value: Number(row._value),
});

/** Several named series sharing one timestamp — what the stacked/overlaid
 * charts plot. A series missing from a window reads as 0. */
export interface MultiPoint {
  time: string;
  values: Record<string, number>;
}

const multiPoint =
  (keys: readonly string[]) =>
  (row: Record<string, string | undefined>): MultiPoint => ({
    time: row._time ?? "",
    values: Object.fromEntries(keys.map((k) => [k, Number(row[k] ?? 0)])),
  });

/** Per-second rate of several counter fields, one named series each: the
 * mean rate per series within each window, then summed across series of the
 * same kind (e.g. several disks). Summing the raw per-scrape rates instead
 * would multiply by the number of scrapes in the window. */
function counterRates(
  fields: Record<string, string>,
  fluxRange: string,
  window: string,
  name: string,
  opts?: QueryOpts,
): Promise<MultiPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const entries = Object.entries(fields);
  const fieldFilter = entries.map(([, field]) => `r._field == "${field}"`).join(" or ");
  const kindExpr = entries
    .slice(0, -1)
    .reduceRight(
      (otherwise, [key, field]) => `if r._field == "${field}" then "${key}" else ${otherwise}`,
      `"${entries.at(-1)![0]}"`,
    );
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => ${fieldFilter})
      |> derivative(unit: 1s, nonNegative: true)
      |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
      |> map(fn: (r) => ({ r with kind: ${kindExpr} }))
      |> group(columns: ["_time", "kind"])
      |> sum()
      |> group()
      |> pivot(rowKey: ["_time"], columnKey: ["kind"], valueColumn: "_value")
      |> sort(columns: ["_time"])
      |> yield(name: "${name}")
  `;
  return runFluxQuery(query, multiPoint(Object.keys(fields)));
}

/** DB host CPU usage % over time: 100 × busy / (busy + idle) from the
 * per-core mode counters. */
export function querySupabaseDbCpuPct(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<PlatformPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "node_cpu_seconds_total")
      |> derivative(unit: 1s, nonNegative: true)
      |> map(fn: (r) => ({ r with kind: if r.mode == "idle" then "idle" else "busy" }))
      |> group(columns: ["kind"])
      |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)
      |> pivot(rowKey: ["_time"], columnKey: ["kind"], valueColumn: "_value")
      |> map(fn: (r) => ({ _time: r._time, _value: if r.busy + r.idle == 0.0 then 0.0 else 100.0 * r.busy / (r.busy + r.idle) }))
      |> yield(name: "db_cpu_pct")
  `;
  return runFluxQuery(query, point);
}

/** DB host memory usage % over time: 100 × (1 − MemAvailable / MemTotal). */
export function querySupabaseDbMemoryPct(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<PlatformPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "node_memory_MemAvailable_bytes" or r._field == "node_memory_MemTotal_bytes")
      |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> map(fn: (r) => ({ _time: r._time, _value: if r.node_memory_MemTotal_bytes == 0.0 then 0.0 else 100.0 * (1.0 - r.node_memory_MemAvailable_bytes / r.node_memory_MemTotal_bytes) }))
      |> yield(name: "db_memory_pct")
  `;
  return runFluxQuery(query, point);
}

/** DB host CPU split into busy (excluding iowait) and iowait, both % of all
 * CPU time. iowait is time spent idle waiting on disk — the closest signal to
 * "the database is IO-bound" that the endpoint gives without node_disk_*. */
export function querySupabaseCpuBreakdown(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<MultiPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  // Flux returns the raw per-kind sums; the ratio is computed here so the
  // two series share one scan.
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "node_cpu_seconds_total")
      |> derivative(unit: 1s, nonNegative: true)
      |> map(fn: (r) => ({ r with kind: if r.mode == "idle" then "idle" else if r.mode == "iowait" then "iowait" else "busy" }))
      |> group(columns: ["kind"])
      |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)
      |> pivot(rowKey: ["_time"], columnKey: ["kind"], valueColumn: "_value")
      |> yield(name: "db_cpu_breakdown")
  `;
  return runFluxQuery(query, multiPoint(["busy", "idle", "iowait"])).then((rows) =>
    rows.map(({ time, values }) => {
      const total = (values.busy ?? 0) + (values.idle ?? 0) + (values.iowait ?? 0);
      const pct = (v: number | undefined) => (total === 0 ? 0 : (100 * (v ?? 0)) / total);
      return { time, values: { busy: pct(values.busy), iowait: pct(values.iowait) } };
    }),
  );
}

/** Swap usage % over time: 100 × (1 − SwapFree / SwapTotal); 0 when the host
 * has no swap configured. */
export function querySupabaseSwapPct(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<PlatformPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "node_memory_SwapFree_bytes" or r._field == "node_memory_SwapTotal_bytes")
      |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> map(fn: (r) => ({ _time: r._time, _value: if r.node_memory_SwapTotal_bytes == 0.0 then 0.0 else 100.0 * (1.0 - r.node_memory_SwapFree_bytes / r.node_memory_SwapTotal_bytes) }))
      |> yield(name: "db_swap_pct")
  `;
  return runFluxQuery(query, point);
}

/** Database volume usage % over time. Only the /data mount: the host also
 * reports its root filesystem (/), a small OS disk Supabase manages that sits
 * far fuller than the database and isn't ours to act on. */
export function querySupabaseDbDiskPct(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<PlatformPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "node_filesystem_avail_bytes" or r._field == "node_filesystem_size_bytes")
      |> filter(fn: (r) => r.mountpoint == "/data")
      |> keep(columns: ["_time", "_field", "_value", "mountpoint"])
      |> pivot(rowKey: ["_time", "mountpoint"], columnKey: ["_field"], valueColumn: "_value")
      |> map(fn: (r) => ({ _time: r._time, _value: if r.node_filesystem_size_bytes == 0.0 then 0.0 else 100.0 * (1.0 - r.node_filesystem_avail_bytes / r.node_filesystem_size_bytes) }))
      |> group()
      |> aggregateWindow(every: ${window}, fn: max, createEmpty: false)
      |> yield(name: "db_disk_pct")
  `;
  return runFluxQuery(query, point);
}

/** Total backends (connections) across databases, over time. */
export function querySupabaseDbConnections(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<PlatformPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "pg_stat_database_num_backends")
      |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
      |> group(columns: ["_time"])
      |> sum()
      |> group()
      |> sort(columns: ["_time"])
      |> yield(name: "db_connections")
  `;
  return runFluxQuery(query, point);
}

/** The connection limit (max_connections), latest value. */
export async function querySupabaseMaxConnections(opts?: QueryOpts): Promise<number | null> {
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -1h)
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "max_connections_connection_count")
      |> group()
      |> last()
      |> yield(name: "max_connections")
  `;
  const rows = await runFluxQuery(query, point);
  return rows.length > 0 && rows[0] ? rows[0].value : null;
}

/** Buffer cache hit rate % over time: 100 × hit / (hit + read). Windows with
 * no reads at all count as 100%. */
export function querySupabaseDbCacheHitPct(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<PlatformPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "pg_stat_database_blks_hit_total" or r._field == "pg_stat_database_blks_read_total")
      |> derivative(unit: 1s, nonNegative: true)
      |> map(fn: (r) => ({ r with kind: if r._field == "pg_stat_database_blks_hit_total" then "hit" else "read" }))
      |> group(columns: ["kind"])
      |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)
      |> pivot(rowKey: ["_time"], columnKey: ["kind"], valueColumn: "_value")
      |> map(fn: (r) => ({ _time: r._time, _value: if r.hit + r.read == 0.0 then 100.0 else 100.0 * r.hit / (r.hit + r.read) }))
      |> yield(name: "db_cache_hit_pct")
  `;
  return runFluxQuery(query, point);
}

/** Mean statement execution time in ms over time, from the DB-wide
 * pg_stat_statements counters: Δtotal_time / Δtotal_queries. */
export function querySupabaseMeanQueryMs(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<PlatformPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "pg_stat_statements_total_time_seconds" or r._field == "pg_stat_statements_total_queries")
      |> derivative(unit: 1s, nonNegative: true)
      |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> map(fn: (r) => ({ _time: r._time, _value: if r.pg_stat_statements_total_queries == 0.0 then 0.0 else 1000.0 * r.pg_stat_statements_total_time_seconds / r.pg_stat_statements_total_queries }))
      |> yield(name: "db_mean_query_ms")
  `;
  return runFluxQuery(query, point);
}

/** Statements executed per second, over time. */
export function querySupabaseQueryRate(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<PlatformPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "pg_stat_statements_total_queries")
      |> derivative(unit: 1s, nonNegative: true)
      |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
      |> yield(name: "db_query_rate")
  `;
  return runFluxQuery(query, point);
}

/** Transactions per second, committed vs rolled back. */
export function querySupabaseTransactions(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<MultiPoint[]> {
  return counterRates(
    { commit: "pg_stat_database_xact_commit_total", rollback: "pg_stat_database_xact_rollback_total" },
    fluxRange,
    window,
    "db_transactions",
    opts,
  );
}

/** Share of transactions rolled back, %, per window of a transactions
 * series. A rising share means the app is erroring mid-transaction. */
export function rollbackPct(transactions: MultiPoint[]): PlatformPoint[] {
  return transactions.map(({ time, values }) => {
    const commit = values.commit ?? 0;
    const rollback = values.rollback ?? 0;
    const total = commit + rollback;
    return { time, value: total === 0 ? 0 : (100 * rollback) / total };
  });
}

/** Rows written and read per second. fetched = rows read by index scans,
 * the bulk of read traffic. */
export function querySupabaseRowActivity(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<MultiPoint[]> {
  return counterRates(
    {
      inserted: "pg_stat_database_tup_inserted_total",
      updated: "pg_stat_database_tup_updated_total",
      deleted: "pg_stat_database_tup_deleted_total",
      fetched: "pg_stat_database_tup_fetched_total",
    },
    fluxRange,
    window,
    "db_row_activity",
    opts,
  );
}

/** Bytes per second written to temp files by queries that outgrew work_mem
 * (big sorts, hashes). Should sit at 0. */
export function querySupabaseTempBytes(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<PlatformPoint[]> {
  return counterRates({ temp: "pg_stat_database_temp_bytes_total" }, fluxRange, window, "db_temp_bytes", opts).then(
    (rows) => rows.map(({ time, values }) => ({ time, value: values.temp ?? 0 })),
  );
}

/** Disk read/write bytes per second, summed across the host's disks (the OS
 * disk and the /data volume). Needs node_disk_* in the Telegraf fieldinclude;
 * empty until that's deployed. */
export function querySupabaseDiskIo(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<MultiPoint[]> {
  return counterRates(
    { read: "node_disk_read_bytes_total", write: "node_disk_written_bytes_total" },
    fluxRange,
    window,
    "db_disk_io",
    opts,
  );
}

/** Deadlocks detected over the range. increase() handles counter resets;
 * null when there's no data for the range. */
export async function querySupabaseDeadlocks(fluxRange = "24h", opts?: QueryOpts): Promise<number | null> {
  assertValidFluxDuration(fluxRange, "range");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "pg_stat_database_deadlocks_total")
      |> increase()
      |> last()
      |> group()
      |> sum()
      |> yield(name: "db_deadlocks")
  `;
  const rows = await runFluxQuery(query, point);
  return rows.length > 0 && rows[0] ? rows[0].value : null;
}

/** Mean auth (GoTrue) API request latency in ms over time, summed across
 * routes: Δduration_sum / Δrequest_count. PostgREST exposes no equivalent —
 * data-path latency comes from app-side instrumentation instead. */
export function querySupabaseAuthApiMs(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<PlatformPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "http_server_request_duration_seconds_sum" or r._field == "http_server_request_duration_seconds_count")
      |> derivative(unit: 1s, nonNegative: true)
      |> map(fn: (r) => ({ r with kind: if r._field == "http_server_request_duration_seconds_sum" then "sum" else "count" }))
      |> group(columns: ["kind"])
      |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)
      |> pivot(rowKey: ["_time"], columnKey: ["kind"], valueColumn: "_value")
      |> map(fn: (r) => ({ _time: r._time, _value: if r.count == 0.0 then 0.0 else 1000.0 * r.sum / r.count }))
      |> yield(name: "auth_api_ms")
  `;
  return runFluxQuery(query, point);
}

export interface AuthRouteStat {
  route: string;
  method: string;
  count: number;
  meanMs: number;
}

/** Auth (GoTrue) API calls per route over the range: request count and mean
 * latency, busiest first. increase() handles counter resets; per-series
 * increases are summed across status codes before the sum/count ratio. */
export function querySupabaseAuthRoutes(fluxRange = "24h", opts?: QueryOpts): Promise<AuthRouteStat[]> {
  assertValidFluxDuration(fluxRange, "range");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "http_server_request_duration_seconds_sum" or r._field == "http_server_request_duration_seconds_count")
      |> map(fn: (r) => ({ r with kind: if r._field == "http_server_request_duration_seconds_sum" then "sum" else "count" }))
      |> increase()
      |> last()
      |> group(columns: ["http_route", "http_request_method", "kind"])
      |> sum()
      |> group()
      |> pivot(rowKey: ["http_route", "http_request_method"], columnKey: ["kind"], valueColumn: "_value")
      |> filter(fn: (r) => exists r.count and r.count > 0.0)
      |> map(fn: (r) => ({ http_route: r.http_route, http_request_method: r.http_request_method, count: r.count, mean_ms: 1000.0 * r.sum / r.count }))
      |> sort(columns: ["count"], desc: true)
      |> yield(name: "auth_routes")
  `;
  return runFluxQuery(query, (row) => ({
    route: row.http_route ?? "unknown",
    method: row.http_request_method ?? "?",
    count: Number(row.count),
    meanMs: Number(row.mean_ms),
  }));
}

export interface DatabaseSize {
  database: string;
  sizeBytes: number;
}

/** Latest size per database. */
export function querySupabaseDbSizes(opts?: QueryOpts): Promise<DatabaseSize[]> {
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -1h)
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "pg_database_size_bytes")
      |> group(columns: ["datname"])
      |> last()
      |> yield(name: "db_sizes")
  `;
  return runFluxQuery(query, (row) => ({
    database: row.datname ?? "unknown",
    sizeBytes: Number(row._value),
  }));
}

export interface SupabasePlatformSnapshot {
  cpuPct: number | null;
  memoryPct: number | null;
  diskPct: number | null;
  connections: number | null;
  maxConnections: number | null;
  cacheHitPct: number | null;
  deadlocks24h: number | null;
  lastScrape: string | null;
}

/** Latest value of each headline metric — stat cards and alert rules 25–28.
 * Nulls mean Telegraf hasn't delivered that series recently. */
export async function querySupabasePlatformSnapshot(opts?: QueryOpts): Promise<SupabasePlatformSnapshot> {
  const last = (rows: PlatformPoint[]): number | null => {
    const r = rows.at(-1);
    return r === undefined ? null : r.value;
  };
  const [cpu, memory, disk, connections, maxConnections, cacheHit, deadlocks24h, scrape] = await Promise.all([
    querySupabaseDbCpuPct("15m", "5m", opts),
    querySupabaseDbMemoryPct("15m", "5m", opts),
    querySupabaseDbDiskPct("15m", "5m", opts),
    querySupabaseDbConnections("15m", "5m", opts),
    querySupabaseMaxConnections(opts),
    querySupabaseDbCacheHitPct("15m", "5m", opts),
    querySupabaseDeadlocks("24h", opts),
    querySupabaseLastScrape(opts),
  ]);
  return {
    cpuPct: last(cpu),
    memoryPct: last(memory),
    diskPct: last(disk),
    connections: last(connections),
    maxConnections,
    cacheHitPct: last(cacheHit),
    deadlocks24h,
    lastScrape: scrape,
  };
}

/** Timestamp of the newest platform point — absence rule 28 (scrape silent). */
export async function querySupabaseLastScrape(opts?: QueryOpts): Promise<string | null> {
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -24h)
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "pg_up")
      |> group()
      |> last()
      |> yield(name: "last_scrape")
  `;
  const rows = await runFluxQuery(query, (row) => row._time ?? "");
  return rows.length > 0 && rows[0] ? rows[0] : null;
}
