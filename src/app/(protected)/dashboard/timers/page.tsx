import { createClient } from "@/lib/supabase/server";
import { deleteTimer, listTimers } from "@/actions/supabase/timers";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { TimersRealtime } from "@/components/timers/timers-realtime";

export default async function TimersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const timers = await listTimers(user.id);

  async function onDelete(formData: FormData) {
    "use server";
    const id = String(formData.get("id"));
    await deleteTimer(user.id, id);
  }

  return (
    <div className="space-y-4">
      <TimersRealtime channelId={user.id} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Timers</h1>
        <Link href="/dashboard/timers/new"><Button>Create Timer</Button></Link>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Message</TableHead>
            <TableHead>Interval</TableHead>
            <TableHead>Enabled</TableHead>
            <TableHead>Last Sent</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {timers.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="max-w-md truncate" title={t.message}>{t.message}</TableCell>
              <TableCell>{t.interval_minutes}m</TableCell>
              <TableCell>{t.enabled ? "Yes" : "No"}</TableCell>
              <TableCell>{t.last_sent_at ? new Date(t.last_sent_at).toLocaleString() : "—"}</TableCell>
              <TableCell className="space-x-2">
                <Link href={`/dashboard/timers/${t.id}/edit`}><Button size="sm" variant="secondary">Edit</Button></Link>
                <form action={onDelete} className="inline">
                  <input type="hidden" name="id" value={t.id} />
                  <Button type="submit" size="sm" variant="destructive">Delete</Button>
                </form>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}


