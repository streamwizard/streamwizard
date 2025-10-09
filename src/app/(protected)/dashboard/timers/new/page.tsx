import { createClient } from "@/lib/supabase/server";
import { upsertTimer } from "@/actions/supabase/timers";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export default async function NewTimerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  async function action(formData: FormData) {
    "use server";
    const values = {
      message: String(formData.get("message") || ""),
      interval_minutes: Number(formData.get("interval_minutes") || 15),
      enabled: String(formData.get("enabled") || "true") === "true",
    };
    await upsertTimer(user.id, values);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-4">Create Timer</h1>
      <form action={action} className="space-y-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium">Message</label>
          <Textarea name="message" placeholder="Don’t forget to follow the stream!" />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Interval (minutes)</label>
          <Input type="number" name="interval_minutes" defaultValue={15} min={1} max={180} />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Enabled</label>
          <select name="enabled" defaultValue="true" className="border rounded p-2 text-sm">
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>
        <Button type="submit">Save</Button>
      </form>
    </div>
  );
}


