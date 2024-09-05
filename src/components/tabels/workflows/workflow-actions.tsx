"use client";
import type { CommandTable, WorkflowTable } from "@/types/database";
import { CommandForm } from "@/components/forms/command-form";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { AlertDialogModal } from "@/components/global/alert";
import { DeleteWorkflow } from "@/actions/workflows";
import { ModalBody, Modal, ModalContent, ModalTrigger, ModalFooter, useModal } from "@/components/ui/animated-modal";
import Workflowform from "@/components/forms/workflow-form";

interface Props {
  workflow: WorkflowTable;
}

export default function WorkflowActions({ workflow }: Props) {

  const [alert, setAlert] = React.useState<boolean>(false);
  const { setOpen, open } = useModal();

  const handleDelete = () => {
    toast.promise(DeleteWorkflow(workflow.id), {
      loading: "Loading...",
      success: "Workflow has ben removed",
      error: "Failed to remove workflow",
    });
  };

  const toggleAlert = () => setAlert(!alert);

  return (
    <>
      <AlertDialogModal continueFn={handleDelete} open={alert} toggleOpen={toggleAlert} />
      {/* {open && (
        <ModalBody>
          <ModalContent className="flex justify-center items-center">
            <Workflowform workflow={workflow} />
          </ModalContent>
        </ModalBody>
      )} */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0 text-right">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => {
              setOpen(true);
            }}
          >
            Edit workflow details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAlert(true)}>Delete Workflow</DropdownMenuItem>
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
