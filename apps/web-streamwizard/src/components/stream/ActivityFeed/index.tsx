import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { getActivityFeedData } from "@/actions/supabase/analytics/activity-feed";
import { ActivityFeedClient } from "./ActivityFeedClient";

interface ActivityFeedSectionProps {
  streamId: string;
  broadcasterId: string;
  isLive: boolean;
}

export async function ActivityFeedSection({
  streamId,
  broadcasterId,
  isLive,
}: ActivityFeedSectionProps) {
  const events = await getActivityFeedData(streamId, broadcasterId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Activity feed
          {isLive && (
            <span className="ml-auto flex items-center gap-1.5 text-xs font-normal text-green-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
              Live
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ActivityFeedClient initialEvents={events} streamId={streamId} isLive={isLive} />
      </CardContent>
    </Card>
  );
}
