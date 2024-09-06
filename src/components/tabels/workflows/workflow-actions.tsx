"use client";
import { DeleteWorkflow } from "@/actions/workflows";
import Workflowform from "@/components/forms/workflow-form";
import { AlertDialogModal } from "@/components/global/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useModal } from "@/providers/modal-provider";
import type { WorkflowTable } from "@/types/database";
import { MoreHorizontal } from "lucide-react";
import React from "react";
import { toast } from "sonner";

interface Props {
  workflow: WorkflowTable;
}

export default function WorkflowActions({ workflow }: Props) {
  const [alert, setAlert] = React.useState<boolean>(false);
  const { openModal } = useModal();

  const handleDelete = () => {
    toast.promise(DeleteWorkflow(workflow.id), {
      loading: "Loading...",
      success: "Workflow has ben removed",
      error: "Failed to remove workflow",
    });
  };

  const toggleAlert = () => setAlert(!alert);

  const EditWorkflowDetails = () => {
    openModal(<Workflowform workflow={workflow} />);
  };

  return (
    <>
      <AlertDialogModal continueFn={handleDelete} open={alert} toggleOpen={toggleAlert} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0 text-right">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={EditWorkflowDetails}>Edit workflow details</DropdownMenuItem>
          <DropdownMenuItem onClick={toggleAlert}>Delete Workflow</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              navigator.clipboard.writeText(workflow.id!);
              toast.info("Workflow ID copied to clipboard");
            }}
          >
            Copy Workflow ID
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
