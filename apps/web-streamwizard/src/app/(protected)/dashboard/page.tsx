import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Skeleton } from "@repo/ui";
import { createClient } from "@repo/supabase/next/server";
import {
  getLatestStreamForBroadcaster,
  getBroadcasterProfile,
  getVodByStreamId,
} from "@repo/supabase/queries/stream-analytics";
import { BroadcasterProfileStrip } from "@/components/stream-analytics/broadcaster-profile-strip";
import { StatsRow } from "@/components/stream/StatsRow";
import { ViewerChartSection } from "@/components/stream/ViewerChartSection";
import { ActivityFeedSection } from "@/components/stream/ActivityFeed";
import { RecentStreams } from "@/components/stream/RecentStreams";
import { StreamInfoPanel } from "@/components/stream/StreamInfoPanel";
import { QuickActions } from "@/components/stream/QuickActions";
import type { BroadcasterProfile } from "@/actions/supabase/analytics/stream-analytics";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard — Stream Analytics",
  description: "Live monitoring and post-stream overview",
};

function StatsRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return <Skeleton className="h-72 w-full rounded-xl" />;
}

function FeedSkeleton() {
  return <Skeleton className="h-96 w-full rounded-xl" />;
}

function ListSkeleton() {
  return <Skeleton className="h-56 w-full rounded-xl" />;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) redirect("/login");

  const broadcasterId = data.user.user_metadata.sub as string;

  const stream = await getLatestStreamForBroadcaster(supabase, broadcasterId);

  if (!stream?.stream_id) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed text-center">
        <p className="text-lg font-semibold">No stream data yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Analytics will appear here after your first recorded broadcast.
        </p>
      </div>
    );
  }

  const [profile, vod] = await Promise.all([
    getBroadcasterProfile(supabase),
    getVodByStreamId(supabase, stream.stream_id),
  ]);

  const broadcasterProfile: BroadcasterProfile | null = profile
    ? {
        username: profile.twitch_username,
        profileImageUrl: profile.profile_image_url,
        broadcasterType: profile.broadcaster_type as BroadcasterProfile["broadcasterType"],
      }
    : null;

  const hasVod = !!vod?.video_id;
  const isLive = stream.is_live;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stream Analytics</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Overview for your most recent broadcast
          </p>
        </div>
        {broadcasterProfile && (
          <div className="flex items-center gap-2">
            <BroadcasterProfileStrip profile={broadcasterProfile} />
            {isLive && (
              <span className="flex items-center gap-1.5 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                LIVE
              </span>
            )}
          </div>
        )}
      </div>

      <Suspense fallback={<StatsRowSkeleton />}>
        <StatsRow
          streamId={stream.stream_id}
          broadcasterId={broadcasterId}
          startedAt={stream.stream_started_at}
          endedAt={stream.stream_ended_at}
        />
      </Suspense>

      <div className="grid gap-4" style={{ gridTemplateColumns: "65% 35%" }}>
        <div className="flex min-w-0 flex-col gap-4">
          <Suspense fallback={<ChartSkeleton />}>
            <ViewerChartSection streamId={stream.stream_id} broadcasterId={broadcasterId} />
          </Suspense>

          <Suspense fallback={<FeedSkeleton />}>
            <ActivityFeedSection
              streamId={stream.stream_id}
              broadcasterId={broadcasterId}
              isLive={isLive}
            />
          </Suspense>

          <Suspense fallback={<ListSkeleton />}>
            <RecentStreams
              broadcasterId={broadcasterId}
              excludeStreamId={stream.stream_id}
            />
          </Suspense>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <StreamInfoPanel
            broadcasterId={broadcasterId}
            currentTitle={stream.title}
            currentCategory={stream.category_name}
            currentGameId={stream.category_id}
          />
          <QuickActions
            broadcasterId={broadcasterId}
            streamId={stream.stream_id}
            hasVod={hasVod}
            broadcasterUsername={broadcasterProfile?.username ?? ""}
            streamTitle={stream.title ?? "My Stream"}
          />
        </div>
      </div>
    </div>
  );
}
