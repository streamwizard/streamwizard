import { createClient } from "@/lib/supabase/server";
import { upsertCommand } from "@/actions/supabase/commands";
import { commandSchema, type CommandFormValues } from "@/schemas/command";
import CommandForm from "@/components/commands/command-form";
import { Card } from "@/components/ui/card";

export default async function NewCommandPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const channelId = user.id;

  async function action(formData: FormData) {
    "use server";
    const raw = Object.fromEntries(formData) as any;
    const values: CommandFormValues = {
      trigger: String(raw.trigger || "").replace(/^!/, ""),
      response: String(raw.response || ""),
      permission: (raw.permission as any) || "everyone",
      cooldown_seconds: Number(raw.cooldown_seconds || 0),
      shared: Boolean(raw.shared),
    };
    await upsertCommand(channelId, values);
  }

  return (
    <div className="flex justify-center items-center h-full">
      <Card className="w-full max-w-2xl p-4">
        <CommandForm action={action} submitLabel="Save" />
      </Card>
    </div>
  );
}
