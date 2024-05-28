"use client";
import { Switch } from "@/components/ui/switch";
import useCommands from "@/hooks/useCommands";
import { CommandTable } from "@/types/database";

interface Props {
  command: CommandTable;
}

export default function CommandSwitch({ command }: Props) {
  const { updateCommand } = useCommands();

  const handleSwitch = async (value: boolean) => {
    updateCommand({
      ...command,
      status: !command.status,
    });
  };

  return (
    <>
      <Switch checked={command.status} onCheckedChange={handleSwitch} />
    </>
  );
}
