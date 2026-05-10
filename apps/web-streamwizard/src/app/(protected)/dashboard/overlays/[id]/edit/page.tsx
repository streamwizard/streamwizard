import { getOverlayScene } from "@/actions/overlays";
import { OverlayEditor } from "@/components/overlays/editor/overlay-editor";
import { createClient } from "@repo/supabase/next/server";
import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OverlayEditorPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user?.user) redirect("/login");

  const { data: scene, error } = await getOverlayScene(id);

  if (error || !scene) {
    redirect("/dashboard/overlays");
  }

  const { data: folders } = await supabase.from("clip_folders").select("*");

  return (
    <OverlayEditor
      initialScene={scene}
      clipFolders={folders ?? []}
    />
  );
}
