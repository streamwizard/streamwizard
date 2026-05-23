import { Point } from "@influxdata/influxdb-client";
import { pushPoint } from "./influx-client";

export function trackWsConnection(role: "publisher" | "subscriber" | "bot", event: "open" | "close"): void {
  pushPoint(
    new Point("ws_connection")
      .tag("service", "ws-server")
      .tag("role", role)
      .tag("event", event)
      .intField("count", 1),
  );
}

export function trackWsMessage(role: "publisher" | "subscriber" | "bot", messageType: string): void {
  pushPoint(
    new Point("ws_message")
      .tag("service", "ws-server")
      .tag("role", role)
      .tag("message_type", messageType)
      .intField("count", 1),
  );
}
