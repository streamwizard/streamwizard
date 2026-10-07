import { formatPerSec } from "@/components/apps/app-format";
import type { TraefikScope } from "@/lib/traefik-model";

/** The page for one scope. Production is the page without a filter. */
export const traefikHref = (scope: TraefikScope) => (scope === "prod" ? "/traefik" : `/traefik?env=${scope}`);

/** The chart and error-table endpoint for one scope. */
export const traefikApi = (scope: TraefikScope) => `/api/metrics/traefik?env=${scope}`;

export const SERVER_ERRORS_HINT = "Share of the answers with a 5xx status in the last 5 minutes: the app failed, or Traefik could not reach it.";
export const CLIENT_ERRORS_HINT = "Share of the answers with a 4xx status in the last 5 minutes. Expired logins, pages that do not exist and rate limits land here, so some is normal.";
export const SLOW_HINT = "Share of the HTTP requests that took longer than 1.2 seconds in the last 5 minutes. WebSocket and SSE are left out: they stay open for minutes.";
export const REQUESTS_HINT = "Requests over the last 5 minutes: per second, or per minute for a quiet app. The line is the last hour.";
export const RESPONSE_HINT = "Mean time Traefik waited for the app in the last 5 minutes. Long-lived connections (WebSocket, streams) count with their full length.";
export const DATA_HINT = "Bytes Traefik sent back to visitors, per second, over the last 5 minutes.";
export const CONNECTIONS_HINT = "Connections open on Traefik right now. All apps and environments together, whatever the filter says.";

export const PROBLEMS_HINT = "HTTP only for the speed bands. After a Traefik restart one bar reads low: its counters start again at zero.";
export const PROXY_HINT = "All apps and environments together, whatever the filter says. web is port 80, websecure is port 443, traefik is the internal port Telegraf reads.";
export const ERRORS_TABLE_HINT = "Counted over the range picked in the header. A code an app sends for the first time misses its first hits.";

/** Requests per second, or per minute below one a second: "<0.1/s" says nothing about a quiet app. */
export function formatRequestRate(perSec: number | null | undefined): string {
  if (perSec == null || !Number.isFinite(perSec)) return "—";
  if (perSec >= 1) return formatPerSec(perSec);
  if (perSec === 0) return "0/min";
  const perMin = perSec * 60;
  return perMin < 0.1 ? "<0.1/min" : `${perMin < 10 ? perMin.toFixed(1) : perMin.toFixed(0)}/min`;
}
