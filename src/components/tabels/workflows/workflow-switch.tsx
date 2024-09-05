"use client";
import { Switch } from "@/components/ui/switch";
import { WorkflowTable } from "@/types/database";

interface Props {
  workflow: WorkflowTable;
}

export default function WorkflowSwitch({ workflow }: Props) {
  const handleSwitch = async (value: boolean) => {};

  return (
    <>
      <Switch checked={workflow.publish ? workflow.publish : false} onCheckedChange={handleSwitch} />
    </>
  );
}
