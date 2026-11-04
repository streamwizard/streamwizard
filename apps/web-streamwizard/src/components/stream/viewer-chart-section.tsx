import { getViewerChartData } from "@/server/analytics/viewer-chart";
import { ViewerCountChart } from "@/components/shared/stats/viewer-count-chart";

interface ViewerChartSectionProps {
  streamId: string;
  broadcasterId: string;
}

export async function ViewerChartSection({ streamId, broadcasterId }: ViewerChartSectionProps) {
  const { viewerBuckets, subEvents, followEvents, clips } = await getViewerChartData(
    streamId,
    broadcasterId
  );

  return (
    <ViewerCountChart
      viewerBuckets={viewerBuckets}
      subEvents={subEvents}
      followEvents={followEvents}
      clips={clips}
    />
  );
}
