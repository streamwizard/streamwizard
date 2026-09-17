import type { Json } from "@repo/supabase";
import type { DiscordSettingsAuditWithUser } from "@repo/supabase/queries/discord-audit";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";

const SECTION_LABELS: Record<string, string> = {
  welcome: "Welcome",
  activity: "Activity",
  tickets: "Tickets",
  permissions: "Permissions",
  logs: "Log channel",
  messages: "Messages",
};

const ACTION_LABELS: Record<string, string> = {
  repost_panel: "Re-posted the ticket panel",
  test_welcome: "Sent a test welcome",
  test_log: "Sent a test log event",
  publish: "Published a message",
  delete: "Deleted a message",
  // Section-specific wording wins over the plain action.
  "tickets:create": "Added a ticket category or product",
  "tickets:delete": "Removed a ticket category or product",
};

function formatValue(value: Json | undefined, names: Map<string, string>): string {
  if (value === null || value === undefined) return "none";
  if (typeof value === "boolean") return value ? "on" : "off";
  if (Array.isArray(value)) return value.length ? value.map((v) => formatValue(v, names)).join(", ") : "none";
  if (typeof value === "string") return names.get(value) ?? value;
  return JSON.stringify(value);
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Recent dashboard changes. `names` maps channel and role ids to display
 * labels so the diff reads "#welcome" rather than a snowflake.
 */
export function AuditList({ entries, names }: { entries: DiscordSettingsAuditWithUser[]; names: Map<string, string> }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent changes</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No dashboard changes yet. Slash command changes don&apos;t show up here.</p>
        ) : (
          <ul className="divide-y text-sm">
            {entries.map((entry) => {
              const before = (entry.old_value ?? {}) as Record<string, Json>;
              const after = (entry.new_value ?? {}) as Record<string, Json>;
              const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
              return (
                <li key={entry.id} className="space-y-1 py-2.5 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span>
                      <span className="font-medium">{entry.changed_by_user?.name ?? "Unknown admin"}</span>
                      <span className="text-muted-foreground">
                        {" · "}
                        {ACTION_LABELS[`${entry.section}:${entry.action}`] ??
                          ACTION_LABELS[entry.action] ??
                          `Updated ${SECTION_LABELS[entry.section] ?? entry.section}`}
                      </span>
                    </span>
                    <time className="text-xs text-muted-foreground tabular-nums" dateTime={entry.created_at}>
                      {formatWhen(entry.created_at)}
                    </time>
                  </div>
                  {keys.length > 0 && (
                    <ul className="space-y-0.5 text-xs text-muted-foreground">
                      {keys.map((key) => (
                        <li key={key}>
                          <span className="font-mono">{key}</span>: {formatValue(before[key], names)} →{" "}
                          <span className="text-foreground">{formatValue(after[key], names)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
