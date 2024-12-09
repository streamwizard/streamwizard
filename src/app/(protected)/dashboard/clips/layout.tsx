import TwitchClipSearchForm from "@/components/forms/twitch-clip-filter-form";
import { createClient } from "@/lib/supabase/server";
import { ClipFolderProvider } from "@/providers/clips-provider";

export default async function layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data, error } = await supabase.from("clip_folders").select(`*`).order("created_at", { ascending: false });

  if (error) throw error;

  return (
    <ClipFolderProvider ClipFolders={data || []}>
      <TwitchClipSearchForm />
      {children}
    </ClipFolderProvider>
  );
}
