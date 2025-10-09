import { createClient } from "@/lib/supabase/server";
import { upsertCommand, getCommandById } from "@/actions/supabase/commands";
import { commandSchema, type CommandFormValues } from "@/schemas/command";
import CommandForm from "@/components/commands/command-form";

type Params = {
  params: {
    id: string;
  };
};

export default async function EditCommandPage({ params }: Params) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const existing = await getCommandById(user.id, params.id);

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
    await upsertCommand(user!.id, values, params.id);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-4">Edit Command</h1>
      <CommandForm
        action={action}
        submitLabel="Update"
        defaultValues={{
          trigger: existing.trigger,
          response: existing.response,
          permission: existing.permission as "everyone" | "moderator" | "broadcaster",
          cooldown_seconds: existing.cooldown_seconds ?? 0,
          shared: Boolean(existing.shared),
        }}
      />
    </div>
  );
}
