import { CommandsTable } from "@/components/commands/commands-table";
import { listDefaultCommands } from "@/actions/commands/default-commands";

export default async function DefaultCommandsPage() {
  const commands = await listDefaultCommands();

  return (
    <div className="container mx-auto py-6">
      <CommandsTable commands={commands} />
    </div>
  );
}