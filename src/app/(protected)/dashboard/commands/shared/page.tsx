import { createClient } from "@/lib/supabase/server";
import { getSharedCommands, importCommand } from "@/actions/supabase/commands";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export default async function SharedCommandsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const rows = await getSharedCommands(user.id);
  const ownerIds = Array.from(new Set(rows.map((r) => r.channel_id)));
  const { data: owners } = await supabase.from("users").select("id,name").in("id", ownerIds);
  const ownerName = new Map((owners ?? []).map((o) => [o.id, o.name]));

  async function onImport(formData: FormData) {
    "use server";
    const sourceId = String(formData.get("source_id"));
    await importCommand(user.id, sourceId);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Shared Commands</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Trigger</TableHead>
            <TableHead>Response</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono">!{r.trigger}</TableCell>
              <TableCell className="max-w-md truncate" title={r.response}>{r.response}</TableCell>
              <TableCell>{ownerName.get(r.channel_id) ?? r.channel_id}</TableCell>
              <TableCell>
                <form action={onImport}>
                  <input type="hidden" name="source_id" value={r.id} />
                  <Button type="submit" size="sm">Import</Button>
                </form>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}


