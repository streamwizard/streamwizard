// Client-safe half of nav-counts.ts (that file pulls in the service-role client).

/** The counters next to Tickets, Alerts and Widget review. */
export interface NavCounts {
  /** Open tickets where the opener wrote last. */
  tickets: number;
  /** Firing alerts that aren't silenced. */
  alerts: number;
  /** Widget submissions waiting for a review. */
  widgets: number;
}

export const EMPTY_NAV_COUNTS: NavCounts = { tickets: 0, alerts: 0, widgets: 0 };
