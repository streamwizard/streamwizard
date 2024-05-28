import { auth } from "@/auth";
import { IntegrationsConnectButton } from "@/components/buttons/integrations/spotify";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";

interface Integration {
  [key: string]: {
    account: string;
  };
}

export default async function Page() {
  const session = await auth();
  const supabase = createClient(session?.supabaseAccessToken as string);
  const { data, error } = await supabase.from("user_integrations").select("spotify(account), twitch(account)").single();

  if (error || !data) {
    console.error(error);
    return null;
  }

  const integrations = data as unknown as Integration;

  return (
    <Table className="w-full">
      <TableCaption>A list of integrations.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Integration</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Account</TableHead>
          <TableHead className="text-right" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.keys(data).sort((a,b) => Number(a) + Number(b)).map((key) => {
          if (key === "id" || key === "user_id" || key === "created_at" || key === "updated_at") {
            return;
          }

          return (
            <TableRow key={key}>
              <TableCell className="font-medium capitalize">{key}</TableCell>
              <TableCell>{data[key as keyof typeof data] ? "Connected " : "Not Connected"}</TableCell>
              <TableCell>{integrations[key] ? integrations[key].account : ""}</TableCell>
              <TableCell className="text-right">
                <IntegrationsConnectButton integrations={key} connected={integrations[key] ? true : false} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
