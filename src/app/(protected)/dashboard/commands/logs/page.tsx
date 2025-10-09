import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function CommandLogsPage({ searchParams }: { searchParams?: { q?: string; from?: string; to?: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  let query = supabase
    .from("command_logs")
    .select("user_name, used_at")
    .eq("channel_id", user.id)
    .order("used_at", { ascending: false })
    ;
  if (searchParams?.from) query = query.gte("used_at", new Date(searchParams.from).toISOString());
  if (searchParams?.to) query = query.lte("used_at", new Date(searchParams.to).toISOString());
  const { data, error } = await query.limit(500);
  if (error) throw error;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Command Logs</h1>
      <form className="flex items-end gap-2" method="GET">
        <div className="grid gap-1">
          <label className="text-xs">From</label>
          <input type="date" name="from" defaultValue={searchParams?.from} className="border rounded p-2 text-sm" />
        </div>
        <div className="grid gap-1">
          <label className="text-xs">To</label>
          <input type="date" name="to" defaultValue={searchParams?.to} className="border rounded p-2 text-sm" />
        </div>
        <button className="border rounded px-3 py-2 text-sm" type="submit">Filter</button>
      </form>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Used At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).map((l, idx) => (
            <TableRow key={idx}>
              <TableCell>{l.user_name}</TableCell>
              <TableCell>{l.used_at ? new Date(l.used_at).toLocaleString() : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}


