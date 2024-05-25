import { getCommands } from "@/actions/supabase/table-commands";
import { get_twitch_integration } from "@/actions/supabase/table-twitch_integration";
import { CommandProvider } from "@/providers/commands-provider";

export default async function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const commands = await getCommands();
  // const userdata = await get_twitch_integration();

  console.log(commands)


  return (
    // <CommandProvider initialCommands={commands} broadcaster_id={userdata.broadcaster_id} user_id={userdata.user_id} editor={userdata.account}>
    //   {children}
    // </CommandProvider>
    <></>
  );
}
