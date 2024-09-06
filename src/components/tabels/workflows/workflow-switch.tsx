"use client";
import { UpdatePulbishStatus } from "@/actions/workflows";
import { Switch } from "@/components/ui/switch";
import { WorkflowTable } from "@/types/database";
import { useOptimistic } from "react";
import { toast } from "sonner";

interface Props {
  workflow: WorkflowTable;
}

export default function WorkflowSwitch({ workflow }: Props) {
   const [optimisticState, setOptimistic] = useOptimistic(
    { publish: workflow.publish, loading: false }, // Initial state with loading
    (state, newValue: { publish: boolean; loading: boolean }) => ({
      ...state,
      publish: newValue.publish,
      loading: newValue.loading,
    })
  );

  const handleSwitch = async (value: boolean) => {
    // Set optimistic state with loading true
    setOptimistic({ publish: value, loading: true });

    toast.promise(UpdatePulbishStatus(workflow.id, value), {
      loading: "Updating...",
      success(data) {
        // setOptimistic({ publish: value, loading: false });
        return `${workflow.name} is now enabled`;
      },
      error(data) {
        setOptimistic({ publish: !value, loading: false });
        return `Failed to update ${workflow.name}`;
      },
    });
  };

  return (
    <>
      <Switch checked={optimisticState.publish ?? false} disabled={optimisticState.loading} onCheckedChange={handleSwitch} />
    </>
  );
}
