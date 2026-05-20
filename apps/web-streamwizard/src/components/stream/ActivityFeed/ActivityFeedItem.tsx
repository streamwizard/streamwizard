import type { ActivityEvent } from "@/actions/supabase/analytics/activity-feed";
import { EVENT_CONFIG } from "@/lib/event-config";
import { formatOffset } from "@/lib/format";

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

interface ActivityFeedItemProps {
  event: ActivityEvent;
}

export function ActivityFeedItem({ event }: ActivityFeedItemProps) {
  const config = EVENT_CONFIG[event.event_type];
  if (!config) return null;

  const Icon = config.icon;
  const text = config.label(event.event_data);

  if (config.isDivider) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span className={`flex items-center gap-1 font-medium ${config.color}`}>
          <Icon className="h-3 w-3" />
          {text}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
    );
  }

  return (
    <div
      className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
      title={formatTimestamp(event.created_at)}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${config.color}`} />
      <span className="flex-1 truncate">{text}</span>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">
        {formatOffset(event.offset_seconds)}
      </span>
    </div>
  );
}
