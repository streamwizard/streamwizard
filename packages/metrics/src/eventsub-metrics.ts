import { Point } from "@influxdata/influxdb-client";
import { pushPoint } from "./influx-client";

export function trackEventSubReceived(eventType: string, handled: boolean): void {
  pushPoint(
    new Point("eventsub_event")
      .tag("service", "rest-api")
      .tag("event_type", eventType)
      .tag("handled", String(handled))
      .intField("count", 1),
  );
}

export function trackEventSubRevocation(eventType: string): void {
  pushPoint(
    new Point("eventsub_revocation")
      .tag("service", "rest-api")
      .tag("event_type", eventType)
      .intField("count", 1),
  );
}
