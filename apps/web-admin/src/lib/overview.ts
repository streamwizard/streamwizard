// The dashboard's logic, kept free of server imports so it can be unit-tested:
// what needs attention, and whether each subsystem is healthy.

export type Health = "ok" | "warn" | "crit" | "silenced" | "none";

export interface Subsystem {
  key: string;
  label: string;
  href: string;
  /** Alert rule id prefixes (the part before the first dot) that watch this subsystem. */
  prefixes: string[];
}

export const SUBSYSTEMS: Subsystem[] = [
  { key: "api", label: "API", href: "/http", prefixes: ["api"] },
  { key: "ws", label: "WebSocket", href: "/ws", prefixes: ["ws"] },
  { key: "eventsub", label: "EventSub", href: "/eventsub", prefixes: ["eventsub"] },
  { key: "database", label: "Database", href: "/supabase", prefixes: ["db", "supabase"] },
  { key: "obs", label: "OBS nodes", href: "/obs", prefixes: ["gpu", "obs"] },
  { key: "ingest", label: "Ingest", href: "/ingest", prefixes: ["ingest"] },
  { key: "vms", label: "VMs", href: "/vms", prefixes: ["vm"] },
  { key: "backups", label: "Backups", href: "/backups", prefixes: ["backup"] },
];

/** Rules that belong to none of the subsystems above (probes, the engine's own checks). */
const OTHER: Subsystem = { key: "other", label: "Other checks", href: "/alerts", prefixes: [] };

export interface RuleInfo {
  id: string;
  title: string;
  defaultEnabled: boolean;
  defaultEnvs: string[];
}

export interface RuleOverride {
  rule_id: string;
  enabled: boolean;
  envs: string[] | null;
}

export interface AlertStateLike {
  id: string;
  rule_id: string;
  entity_id: string | null;
  status: string;
  severity: string | null;
  message: string | null;
  silenced_until: string | null;
}

export interface SubsystemStatus extends Subsystem {
  health: Health;
  /** Short status text next to the name: "OK", "2 firing", "No checks". */
  detail: string;
}

const rulePrefix = (ruleId: string) => ruleId.split(".")[0] ?? "";

const KNOWN_PREFIXES = new Set(SUBSYSTEMS.flatMap((subsystem) => subsystem.prefixes));

function belongsTo(subsystem: Subsystem, ruleId: string): boolean {
  const prefix = rulePrefix(ruleId);
  return subsystem === OTHER ? !KNOWN_PREFIXES.has(prefix) : subsystem.prefixes.includes(prefix);
}

export const isSilenced = (state: AlertStateLike, now: number) =>
  !!state.silenced_until && new Date(state.silenced_until).getTime() > now;

/** Firing and not silenced, worst first. */
export function activeAlerts(states: AlertStateLike[], now: number): AlertStateLike[] {
  return states
    .filter((state) => state.status === "firing" && !isSilenced(state, now))
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "crit" ? -1 : 1));
}

/** Does this rule run in this environment, once the admin's overrides are applied? */
function ruleIsWatching(rule: RuleInfo, override: RuleOverride | undefined, env: string): boolean {
  const enabled = override ? override.enabled : rule.defaultEnabled;
  const envs = override?.envs ?? rule.defaultEnvs;
  return enabled && envs.includes(env);
}

/**
 * One status per subsystem, read from the alert engine's own state so the
 * dashboard can never disagree with /alerts. A subsystem nothing watches says
 * "No checks": it must not look healthy just because nothing can fire.
 */
export function buildSubsystemStatus(
  states: AlertStateLike[],
  rules: RuleInfo[],
  overrides: RuleOverride[],
  env: string,
  now: number,
): SubsystemStatus[] {
  const overrideByRule = new Map(overrides.map((override) => [override.rule_id, override]));
  const watching = rules.filter((rule) => ruleIsWatching(rule, overrideByRule.get(rule.id), env));

  const statusOf = (subsystem: Subsystem): SubsystemStatus => {
    const firing = states.filter((state) => state.status === "firing" && belongsTo(subsystem, state.rule_id));
    const loud = firing.filter((state) => !isSilenced(state, now));

    if (loud.length > 0) {
      const health: Health = loud.some((state) => state.severity === "crit") ? "crit" : "warn";
      return { ...subsystem, health, detail: `${loud.length} firing` };
    }
    if (firing.length > 0) return { ...subsystem, health: "silenced", detail: `${firing.length} silenced` };
    if (!watching.some((rule) => belongsTo(subsystem, rule.id))) return { ...subsystem, health: "none", detail: "No checks" };
    return { ...subsystem, health: "ok", detail: "OK" };
  };

  const result = SUBSYSTEMS.map(statusOf);
  const other = statusOf(OTHER);
  // The catch-all only earns a chip when something is actually in it.
  if (other.health !== "none") result.push(other);
  return result;
}

export type AttentionTone = "crit" | "warn" | "info";

export interface AttentionItem {
  key: string;
  tone: AttentionTone;
  title: string;
  detail?: string;
  href: string;
}

/** What each "not set up" page is missing, in words. Keys are the hrefs from getDiscordSetupGaps. */
const SETUP_GAP_TEXT: Record<string, string> = {
  "/discord/welcome": "Welcome messages have no channel",
  "/discord/tickets/settings": "Tickets need a panel channel and a category",
  "/discord/logs/settings": "The event log has no default channel",
  "/discord/live": "Go-live posts have no channel",
};

const MAX_ALERT_ROWS = 5;
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * The "Needs attention" list, worst first: firing alerts, then the queues a
 * person has to work through, then setup gaps. Empty means all clear.
 */
export function buildAttentionList(input: {
  alerts: AlertStateLike[];
  ruleTitles: Map<string, string>;
  ticketsAwaitingStaff: number;
  pendingWidgets: number;
  failedClipSyncs: number;
  setupGaps: string[];
}): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const alert of input.alerts.slice(0, MAX_ALERT_ROWS)) {
    items.push({
      key: `alert-${alert.id}`,
      tone: alert.severity === "crit" ? "crit" : "warn",
      title: input.ruleTitles.get(alert.rule_id) ?? alert.rule_id,
      detail: [alert.entity_id, alert.message].filter(Boolean).join(" · ") || undefined,
      href: "/alerts",
    });
  }
  if (input.alerts.length > MAX_ALERT_ROWS) {
    const rest = input.alerts.length - MAX_ALERT_ROWS;
    items.push({ key: "alerts-more", tone: "warn", title: `${plural(rest, "more alert", "more alerts")} firing`, href: "/alerts" });
  }

  if (input.ticketsAwaitingStaff > 0) {
    items.push({
      key: "tickets",
      tone: "warn",
      title: `${plural(input.ticketsAwaitingStaff, "ticket is", "tickets are")} waiting for a reply`,
      href: "/discord/tickets?status=needs_reply",
    });
  }
  if (input.failedClipSyncs > 0) {
    items.push({
      key: "clip-syncs",
      tone: "warn",
      title: `${plural(input.failedClipSyncs, "clip sync", "clip syncs")} failed`,
      href: "/database",
    });
  }
  if (input.pendingWidgets > 0) {
    items.push({
      key: "widgets",
      tone: "info",
      title: `${plural(input.pendingWidgets, "widget is", "widgets are")} waiting for review`,
      href: "/widget-library",
    });
  }
  for (const href of input.setupGaps) {
    items.push({ key: `setup-${href}`, tone: "info", title: SETUP_GAP_TEXT[href] ?? "A Discord feature isn't set up", href });
  }

  return items;
}

/** "42m" / "3h 5m": how long a stream has been live. */
export function formatLiveFor(startedAt: string | null, now: number): string {
  if (!startedAt) return "—";
  const mins = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60_000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
