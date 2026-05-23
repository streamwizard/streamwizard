import { Point } from "@influxdata/influxdb-client";
import { pushPoint } from "./influx-client";

export function trackHttpRequest(method: string, route: string, status: number, durationMs: number, app: string): void {
  pushPoint(
    new Point("http_request")
      .tag("service", app)
      .tag("method", method.toUpperCase())
      .tag("route", route)
      .tag("status", String(status))
      .floatField("duration_ms", durationMs),
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function metricsMiddleware(app = "rest-api"): (c: any, next: () => Promise<void>) => Promise<void> {
  return async (c, next) => {
    const start = performance.now();
    await next();
    trackHttpRequest(c.req.method, c.req.routePath ?? c.req.path, c.res.status, performance.now() - start, app);
  };
}
