import { Point } from "@influxdata/influxdb-client";
import { pushPoint, isMetricsEnabled, closeInflux } from "./influx-client";

export function trackTwitchApiRequest(method: string, endpoint: string, status: string, app: string = "unknown"): void {
  pushPoint(
    new Point("twitch_api_request")
      .tag("service", "twitch-tools")
      .tag("method", method.toUpperCase())
      .tag("endpoint", endpoint)
      .tag("status", status)
      .tag("app", app)
      .intField("count", 1)
      .timestamp(new Date()),
  );
}

export async function closeMetrics(): Promise<void> {
  await closeInflux();
}

export { isMetricsEnabled };
