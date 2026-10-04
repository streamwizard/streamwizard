"use client";

import { Radio, Users } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { DataList } from "@/components/widgets/data-list";
import { PageHeader } from "@/components/widgets/page-header";
import { StatCard } from "@/components/widgets/stat-card";
import { StatGrid } from "@/components/widgets/stat-grid";
import { StatusIndicator } from "@/components/widgets/status-indicator";
import { useWideScreen } from "@/hooks/use-wide-screen";
import { cn } from "@/lib/utils";
import { useMonitor } from "@/components/ws-monitor-provider";

export function WsRoomTable() {
  const { snapshot, status, events } = useMonitor();
  // The room graph is a desktop tool: rows only link to it where it can open.
  const wide = useWideScreen();

  const rooms = snapshot?.rooms ?? [];
  const totalConnections = snapshot?.totalConnections ?? 0;
  const publishersOnline = rooms.filter((r) => r.hasPublisher).length;
  const totalSubscribers = rooms.reduce((acc, r) => acc + r.subscriberCount, 0);

  const recentByRoom = new Map<string, { eventType: string; ts: number }>();
  for (const evt of events) {
    if (evt.kind !== "message") continue;
    const existing = recentByRoom.get(evt.roomId);
    if (!existing || evt.ts > existing.ts) {
      recentByRoom.set(evt.roomId, { eventType: evt.eventType ?? "unknown", ts: evt.ts });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Rooms" description="Every room on ws-server right now, from the monitor socket.">
        <StatusIndicator
          status={status === "connected" ? "ok" : status === "connecting" ? "warn" : "crit"}
          label={status === "connected" ? "Live, snapshots every 5s" : status === "connecting" ? "Connecting…" : "Disconnected"}
          className="text-muted-foreground"
        />
      </PageHeader>

      <StatGrid cols={4}>
        <StatCard title="Active rooms" value={rooms.length} />
        <StatCard title="Connections" value={totalConnections} />
        <StatCard title="Publishers online" value={publishersOnline} />
        <StatCard title="Total subscribers" value={totalSubscribers} />
      </StatGrid>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-sm font-medium">Active rooms</CardTitle>
          {rooms.length > 0 && <p className="hidden text-xs text-muted-foreground md:block">Select a room to open its graph.</p>}
        </CardHeader>
        {/* Phone cards run edge to edge; the table keeps the card's padding. */}
        <CardContent className="px-0 sm:px-6">
          {rooms.length === 0 ? (
            <div className="flex h-32 items-center justify-center px-4 text-sm text-muted-foreground">
              {status !== "connected" ? "Waiting for connection…" : "No active rooms"}
            </div>
          ) : (
            <DataList
              rows={rooms}
              rowKey={(room) => room.roomId}
              rowHref={wide ? (room) => `/ws/topology/${encodeURIComponent(room.roomId)}` : undefined}
              columns={[
                {
                  key: "room",
                  header: "Room ID",
                  mobile: "title",
                  cell: (room) => <span className="font-mono text-xs break-all">{room.roomId}</span>,
                },
                {
                  key: "publisher",
                  header: "Publisher",
                  mobile: "badge",
                  cell: (room) => (
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-normal",
                        room.hasPublisher ? "border-green-600/30 bg-green-600/20 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Radio className="mr-1 h-3 w-3" aria-hidden />
                      {room.hasPublisher ? "Online" : "Offline"}
                    </Badge>
                  ),
                },
                {
                  key: "subscribers",
                  header: "Subscribers",
                  cell: (room) => (
                    <span className="inline-flex items-center gap-1 text-sm tabular-nums">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      {room.subscriberCount}
                    </span>
                  ),
                },
                {
                  key: "stream",
                  header: "Stream",
                  // The whole id, wrapped: a cut-off id can't be read or copied on a phone.
                  className: "whitespace-normal",
                  cell: (room) =>
                    room.streamId ? (
                      <span className="font-mono text-xs break-all text-muted-foreground">{room.streamId}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    ),
                },
                {
                  key: "last-event",
                  header: "Last event",
                  cell: (room) => {
                    const recent = recentByRoom.get(room.roomId);
                    return recent ? (
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge variant="secondary" className="font-normal">
                          {recent.eventType}
                        </Badge>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {new Date(recent.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    );
                  },
                },
              ]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
