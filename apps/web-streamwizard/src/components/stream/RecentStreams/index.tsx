import { History, Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { getRecentStreamsData } from "@/actions/supabase/analytics/recent-streams";
import { RecentStreamRow } from "./RecentStreamRow";

interface RecentStreamsProps {
  broadcasterId: string;
  excludeStreamId?: string;
}

export async function RecentStreams({ broadcasterId, excludeStreamId }: RecentStreamsProps) {
  const streams = await getRecentStreamsData(broadcasterId, excludeStreamId);

  const maxPeak = streams.length ? Math.max(...streams.map((s) => s.peakViewers)) : 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Recent streams
        </CardTitle>
      </CardHeader>
      <CardContent>
        {streams.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
            <Inbox className="h-8 w-8" />
            <p className="text-sm">No previous streams found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {streams.map((stream, i) => (
              <RecentStreamRow
                key={stream.streamId}
                stream={stream}
                maxPeak={maxPeak}
                prevPeak={i + 1 < streams.length ? streams[i + 1].peakViewers : null}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
