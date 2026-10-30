import { Point } from "@influxdata/influxdb-client";
import { pushPoint, isMetricsEnabled, closeInflux } from "./influx-client";

/**
 * `ratelimitRemaining` is Helix's `Ratelimit-Remaining` header: points left in
 * the bucket the request was charged to. Watching it fall shows a bucket
 * draining before the 429s start.
 */
export function trackTwitchApiRequest(
  method: string,
  endpoint: string,
  status: string,
  app: string = "unknown",
  ratelimitRemaining?: number,
): void {
  const point = new Point("twitch_api_request")
    .tag("service", "twitch-tools")
    .tag("method", method.toUpperCase())
    .tag("endpoint", endpoint)
    .tag("status", status)
    .tag("app", app)
    .intField("count", 1)
    .timestamp(new Date());
  if (ratelimitRemaining !== undefined) point.intField("ratelimit_remaining", ratelimitRemaining);
  pushPoint(point);
}

export async function closeMetrics(): Promise<void> {
  await closeInflux();
}

export { isMetricsEnabled };
