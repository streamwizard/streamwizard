import { getVideos } from "@/actions/twitch/vods";
import { VodsPageClient } from "@/components/vods/vods-page-client";

/**
 * Server component that fetches initial videos and renders the client
 */
export async function VodsContent() {
  const result = await getVideos();

  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
        <h2 className="text-lg font-semibold text-destructive">Failed to load videos</h2>
      </div>
    );
  }

  return <VodsPageClient initialVideos={result.videos || []} initialCursor={result.cursor} />;
}
