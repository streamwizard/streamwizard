import { getHourlyViewerStatsData } from "@/server/analytics/hourly-stats";
import { HourlyViewerChart } from "@/components/shared/hourly-viewer-chart";

interface HourlyStatsSectionProps {
  streamId: string;
  broadcasterId: string;
  streamStartedAt: string;
}

export async function HourlyStatsSection({
  streamId,
  broadcasterId,
  streamStartedAt,
}: HourlyStatsSectionProps) {
  const hourly = await getHourlyViewerStatsData(streamId, broadcasterId, streamStartedAt);

  return <HourlyViewerChart hourlyStats={hourly} />;
}
