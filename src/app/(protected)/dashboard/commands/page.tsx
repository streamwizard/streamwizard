import { createClient } from "@/lib/supabase/server";
import { deleteCommand, listCommands, toggleShare } from "@/actions/supabase/commands";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CommandsRealtime } from "@/components/commands/commands-realtime";
import CommandsTable from "@/components/commands/commands-table";

export default async function CommandsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const channelId = user.id;
  const commands = await listCommands(channelId);

  async function onDelete(formData: FormData) {
    "use server";
    const id = String(formData.get("id"));
    await deleteCommand(channelId, id);
  }

  async function onToggleShare(formData: FormData) {
    "use server";
    const id = String(formData.get("id"));
    const shared = String(formData.get("shared")) === "true";
    await toggleShare(channelId, id, !shared);
  }

  return (
    <div className="space-y-4">
      <CommandsRealtime channelId={channelId} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Commands</h1>
        <Link href="/dashboard/commands/new"><Button>Create Command</Button></Link>
      </div>
      <CommandsTable commands={commands as any} onDelete={onDelete} onToggleShare={onToggleShare} />
    </div>
  );
}


