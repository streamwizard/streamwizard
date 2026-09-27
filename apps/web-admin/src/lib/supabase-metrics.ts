import {
  querySupabaseCpuBreakdown,
  querySupabaseDbCacheHitPct,
  querySupabaseDbConnections,
  querySupabaseDbDiskPct,
  querySupabaseDbMemoryPct,
  querySupabaseDiskIo,
  querySupabaseMeanQueryMs,
  querySupabasePlatformSnapshot,
  querySupabaseQueryRate,
  querySupabaseRowActivity,
  querySupabaseSwapPct,
  querySupabaseTempBytes,
  querySupabaseTransactions,
  querySupabaseAuthApiMs,
  rollbackPct,
  type MultiPoint,
  type PlatformPoint,
  type SupabasePlatformSnapshot,
} from "@repo/metrics";

/** Everything the /supabase page charts, in one payload. The server page
 * renders it as initialData and /api/metrics/supabase serves it to the poll,
 * so both always carry the same keys. */
export interface SupabaseMetrics {
  snapshot: SupabasePlatformSnapshot | null;
  cpuBreakdown: MultiPoint[];
  memory: PlatformPoint[];
  swap: PlatformPoint[];
  disk: PlatformPoint[];
  diskIo: MultiPoint[];
  connections: PlatformPoint[];
  queryRate: PlatformPoint[];
  meanQueryMs: PlatformPoint[];
  transactions: MultiPoint[];
  rollbackPct: PlatformPoint[];
  cacheHit: PlatformPoint[];
  tempBytes: PlatformPoint[];
  rowActivity: MultiPoint[];
  authApiMs: PlatformPoint[];
}

export const EMPTY_SUPABASE_METRICS: SupabaseMetrics = {
  snapshot: null,
  cpuBreakdown: [],
  memory: [],
  swap: [],
  disk: [],
  diskIo: [],
  connections: [],
  queryRate: [],
  meanQueryMs: [],
  transactions: [],
  rollbackPct: [],
  cacheHit: [],
  tempBytes: [],
  rowActivity: [],
  authApiMs: [],
};

/** Keys of SupabaseMetrics that hold a single-value series. */
export type SupabaseSeriesKey = {
  [K in keyof SupabaseMetrics]: SupabaseMetrics[K] extends PlatformPoint[] ? K : never;
}[keyof SupabaseMetrics];

/** Keys of SupabaseMetrics that hold a multi-series series. */
export type SupabaseMultiSeriesKey = {
  [K in keyof SupabaseMetrics]: SupabaseMetrics[K] extends MultiPoint[] ? K : never;
}[keyof SupabaseMetrics];

/** Throws when InfluxDB is unreachable; callers fall back to
 * EMPTY_SUPABASE_METRICS. */
export async function fetchSupabaseMetrics(fluxRange: string, window: string): Promise<SupabaseMetrics> {
  const [
    snapshot,
    cpuBreakdown,
    memory,
    swap,
    disk,
    diskIo,
    connections,
    queryRate,
    meanQueryMs,
    transactions,
    cacheHit,
    tempBytes,
    rowActivity,
    authApiMs,
  ] = await Promise.all([
    querySupabasePlatformSnapshot(),
    querySupabaseCpuBreakdown(fluxRange, window),
    querySupabaseDbMemoryPct(fluxRange, window),
    querySupabaseSwapPct(fluxRange, window),
    querySupabaseDbDiskPct(fluxRange, window),
    querySupabaseDiskIo(fluxRange, window),
    querySupabaseDbConnections(fluxRange, window),
    querySupabaseQueryRate(fluxRange, window),
    querySupabaseMeanQueryMs(fluxRange, window),
    querySupabaseTransactions(fluxRange, window),
    querySupabaseDbCacheHitPct(fluxRange, window),
    querySupabaseTempBytes(fluxRange, window),
    querySupabaseRowActivity(fluxRange, window),
    querySupabaseAuthApiMs(fluxRange, window),
  ]);

  return {
    snapshot,
    cpuBreakdown,
    memory,
    swap,
    disk,
    diskIo,
    connections,
    queryRate,
    meanQueryMs,
    transactions,
    rollbackPct: rollbackPct(transactions),
    cacheHit,
    tempBytes,
    rowActivity,
    authApiMs,
  };
}
