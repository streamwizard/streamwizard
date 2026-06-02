import { InfluxDB, QueryApi } from "@influxdata/influxdb-client";

let queryApi: QueryApi | null = null;

function getQueryApi(): QueryApi {
  if (queryApi) return queryApi;

  const { INFLUXDB_URL, INFLUXDB_TOKEN, INFLUXDB_ORG } = process.env;
  if (!INFLUXDB_URL || !INFLUXDB_TOKEN || !INFLUXDB_ORG) {
    throw new Error("InfluxDB env vars not configured (INFLUXDB_URL, INFLUXDB_TOKEN, INFLUXDB_ORG required)");
  }

  const client = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
  queryApi = client.getQueryApi(INFLUXDB_ORG);
  return queryApi;
}

export async function runFluxQuery<T>(
  query: string,
  rowMapper: (row: Record<string, string>) => T
): Promise<T[]> {
  const api = getQueryApi();
  const results: T[] = [];

  await new Promise<void>((resolve, reject) => {
    api.queryRows(query, {
      next(row, tableMeta) {
        const obj = tableMeta.toObject(row) as Record<string, string>;
        results.push(rowMapper(obj));
      },
      error: reject,
      complete: resolve,
    });
  });

  return results;
}
