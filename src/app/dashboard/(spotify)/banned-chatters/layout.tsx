import { getSpotifySettings } from "@/actions/supabase/table-spotify-settings";
import { auth } from "@/auth";
import { BannedChatterProvider } from "@/providers/banned-chatter-provider";
import { redirect } from "next/navigation";

export default async function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const { data, error } = await getSpotifySettings();

  if (error || !data) {
    console.error(error);
    redirect("/login");
  }

  return (
    <BannedChatterProvider
      broadcaster_id={1}
      editor={session!.user!.name!}
      settings_id={data.id}
      user_id={data.user_id}
      initialBannedChatters={data.spotify_banned_chatters}
    >
      {children}
    </BannedChatterProvider>
  );
}
