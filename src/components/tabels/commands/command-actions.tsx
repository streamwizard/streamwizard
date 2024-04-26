"use client";
import { CommandForm } from "@/components/forms/command-form";
import Modal from "@/components/global/modal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CommandsTable } from "@/types/database/command";
import { MoreHorizontal } from "lucide-react";
import React from "react";
import { toast } from "sonner";

interface Props {
  command: CommandsTable;
}

export default function CommandActions({ command }: Props) {
  const [modal, setModal] = React.useState<boolean>(false);


  return (
    <>
      <Modal open={modal} setModal={setModal}>
        <CommandForm command={command} setModal={setModal} />
      </Modal>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0 text-right">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setModal(true)}>Edit Command</DropdownMenuItem>
          <DropdownMenuItem>Delete Command</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              navigator.clipboard.writeText(command.id!);
              toast.info("Command ID copied to clipboard");
            }}
          >
            Copy Command ID
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
