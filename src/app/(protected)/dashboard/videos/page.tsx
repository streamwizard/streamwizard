import { getVideos } from "@/actions/twitch/vods";
import { VodsPageClient } from "@/components/vods";

export const metadata = {
  title: "VODs - StreamWizard",
  description: "Manage your Twitch VODs",
};

export default async function VideosPage() {
  const result = await getVideos();

  if (!result.success || !result.data) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">{result.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">VODs</h1>
        <p className="text-muted-foreground">
          Manage your archived Twitch streams
        </p>
      </div>

      <VodsPageClient
        initialVideos={result.data.videos}
        initialCursor={result.data.cursor}
      />
    </div>
  );
}