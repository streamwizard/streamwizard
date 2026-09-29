import { InfluxDB, Point, WriteApi } from "@influxdata/influxdb-client";
import type { Bucket } from "./buckets";

let client: InfluxDB | null = null;
let defaultBucket: Bucket | null = null;
const writeApis = new Map<Bucket, WriteApi>();

function envConfigured(): boolean {
  const { INFLUXDB_URL, INFLUXDB_TOKEN, INFLUXDB_ORG } = process.env;
  return !!(INFLUXDB_URL && INFLUXDB_TOKEN && INFLUXDB_ORG);
}

/**
 * Turns metrics on for this process. Each service calls it once at boot with
 * its own bucket (see buckets.ts); processes that never call it write nothing.
 */
export function initMetrics(bucket: Bucket): void {
  defaultBucket = bucket;
}

function getWriteApi(bucket: Bucket): WriteApi | null {
  const existing = writeApis.get(bucket);
  if (existing) return existing;
  if (!envConfigured()) return null;

  try {
    client ??= new InfluxDB({ url: process.env.INFLUXDB_URL!, token: process.env.INFLUXDB_TOKEN! });
    const api = client.getWriteApi(process.env.INFLUXDB_ORG!, bucket, "ms", {
      batchSize: 50,
      flushInterval: 2000,
      maxRetries: 3,
      retryJitter: 200,
    });
    writeApis.set(bucket, api);
    return api;
  } catch {
    return null;
  }
}

/** Writes to `bucket` when given, otherwise to the bucket passed to initMetrics(). */
export function pushPoint(point: Point, bucket?: Bucket): void {
  try {
    if (!defaultBucket) return;
    const api = getWriteApi(bucket ?? defaultBucket);
    if (!api) return;
    api.writePoint(point);
  } catch {
    // never throw from metrics code
  }
}

export function isMetricsEnabled(): boolean {
  return !!defaultBucket && envConfigured();
}

export async function closeInflux(): Promise<void> {
  const apis = [...writeApis.values()];
  writeApis.clear();
  await Promise.all(
    apis.map(async (api) => {
      try {
        await api.close();
      } catch {
        // ignore close errors
      }
    }),
  );
}
