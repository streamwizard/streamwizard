import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";
import { CommandProvider } from "@/providers/commands-provider";

export default async function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  const supabase = createClient(session?.supabaseAccessToken as string);

  const { data } = await supabase.from("twitch_integration").select("*, commands(*)").single();

  if(!data) return null;

  return (
    <CommandProvider initialCommands={data?.commands} broadcaster_id={data.broadcaster_id} user_id={data.user_id} editor='Jochemwhite'>
      {children}
    </CommandProvider>
    // <></>
  );
}
