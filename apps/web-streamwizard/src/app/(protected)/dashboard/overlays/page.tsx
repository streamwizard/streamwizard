import { getOverlayScenes } from "@/actions/overlays";
import { OverlayScenesList } from "@/components/overlays/editor/overlay-scenes-list";
import { redirect } from "next/navigation";
import { createClient } from "@repo/supabase/next/server";

export default async function OverlaysPage() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user?.user) redirect("/login");

  const { data: scenes, error } = await getOverlayScenes();

  if (error) {
    return (
      <div className="text-destructive">
        Failed to load overlays: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overlays</h1>
        <p className="text-muted-foreground">
          Create and manage your stream overlays. Add them as browser sources in OBS.
        </p>
      </div>
      <OverlayScenesList scenes={scenes ?? []} />
    </div>
  );
}
