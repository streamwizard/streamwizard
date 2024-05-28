"use client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import TruncatedText from "@/components/ui/truncated-text";
import CommandActions from "./command-actions";
import CommandSwitch from "./command-switch";
import { CommandTable } from "@/types/database";

export const CommandColumns: ColumnDef<CommandTable>[] = [
  {
    id: "Select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} aria-label="Select row" />,
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <CommandSwitch command={row.original} />,
    enableHiding: false,
    enableSorting: false,
  },
  {
    accessorKey: "command",
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Commands
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => <div className="lowercase pl-4">{row.getValue("command")}</div>,
    enableHiding: true,
  },

  {
    accessorKey: "message",
    header: () => <div className="">Message</div>,
    cell: ({ row }) => {
      return <TruncatedText message={row.getValue("message")} />;
    },
  },
  {
    accessorKey: "userlevel",
    header: () => <div className="">Userlevel</div>,
    cell: ({ row }) => {
      return <div className="font-medium capitalize">{row.getValue("userlevel")}</div>;
    },
  },
  {
    accessorKey: "cooldown",
    header: () => <div className="">Cooldown</div>,
    cell: ({ row }) => {
      return <div className=" font-medium capitalize">{row.getValue("cooldown")} sec</div>;
    },
  },
  {
    accessorKey: "updated_by",
    header: () => <div className="">Updated by</div>,
    cell: ({ row }) => {
      return <div className=" font-medium capitalize">{row.getValue("updated_by")}</div>;
    },
  },
  {
    accessorKey: "updated_at",
    header: () => <div className="">Updated at</div>,
    cell: ({ row }) => {
      return <div className=" font-medium capitalize">{new Date(row.getValue("updated_at")).toLocaleDateString()}</div>;
    },
  },
  {
    accessorKey: "created_at",
    header: () => <div className="">Created At</div>,
    cell: ({ row }) => {
      return <div className=" font-medium capitalize">{new Date(row.getValue("created_at")).toLocaleDateString()}</div>;
    },
  },
  {
    accessorKey: "id",
    header: () => <div className="">Command ID</div>,
    cell: ({ row }) => {
      return (
        <div className="font-medium">
          <p>{row.getValue("id")}</p>
        </div>
      );
    },
  },

  {
    id: "actions",
    enableHiding: false,
    header: () => <div className="">Actions</div>,
    cell: ({ row }) => {
      const command = row.original;

      return <CommandActions command={command} />;
    },
  },
];
