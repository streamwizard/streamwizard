import { createClient } from "@/lib/supabase/server";
import { upsertTimer } from "@/actions/supabase/timers";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default async function EditTimerPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: timer } = await supabase.from("timers").select("*").eq("channel_id", user.id).eq("id", params.id).single();
  if (!timer) return null;

  async function action(formData: FormData) {
    "use server";
    const values = {
      message: String(formData.get("message") || ""),
      interval_minutes: Number(formData.get("interval_minutes") || 15),
      enabled: String(formData.get("enabled") || String(!!timer.enabled)) === "true",
    };
    await upsertTimer(user.id, values, timer.id);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-4">Edit Timer</h1>
      <form action={action} className="space-y-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium">Message</label>
          <Textarea name="message" defaultValue={timer.message} />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Interval (minutes)</label>
          <Input type="number" name="interval_minutes" defaultValue={timer.interval_minutes} min={1} max={180} />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Enabled</label>
          <select name="enabled" defaultValue={String(!!timer.enabled)} className="border rounded p-2 text-sm">
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>
        <Button type="submit">Save</Button>
      </form>
    </div>
  );
}


