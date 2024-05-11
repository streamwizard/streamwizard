import { getSpotifySettings } from "@/actions/supabase/table-spotify-settings";
import { BannedChatterProvider } from "@/providers/banned-chatter-provider";
import { redirect } from "next/navigation";

export default async function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSpotifySettings();

  if (settings.error) {
    redirect("/login");
  }

  return (
    <BannedChatterProvider
      broadcaster_id={settings.data.broadcaster_id}
      editor="jochemwhite"
      settings_id={settings.data.id}
      user_id={settings.data.user_id}
      initialBannedChatters={settings.data.spotify_banned_chatters}
    >
      {children}
    </BannedChatterProvider>
  );
}
