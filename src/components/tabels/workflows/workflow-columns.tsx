"use client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import TruncatedText from "@/components/ui/truncated-text";
import { WorkflowTable } from "@/types/database";
import WorkflowSwitch from "./workflow-switch";
import WorkflowActions from "./workflow-actions";
import Link from "next/link";

export const WorkflowColumns: ColumnDef<WorkflowTable>[] = [
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
    cell: ({ row }) => <WorkflowSwitch workflow={row.original} />,
    enableHiding: false,
    enableSorting: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => <div className="lowercase pl-4">{row.getValue("name")}</div>,
    enableHiding: true,
  },

  {
    accessorKey: "description",
    header: () => <div className="">Description</div>,
    cell: ({ row }) => {
      return (
        <div className="w-96">
          <TruncatedText message={row.getValue("description")} />
        </div>
      );
    },
  },
  {
    accessorKey: "created_at",
    header: () => <div className="">Created At</div>,
    cell: ({ row }) => {
      return <div className=" font-medium capitalize">{new Date(row.getValue("created_at")).toLocaleDateString()}</div>;
    },
    enableSorting: true
  },
  {
    id: "button",
    enableHiding: false,
    cell: ({ row }) => {
      return (
        <Link href={`/dashboard/workflows/editor/${row.original.id}`}>
          <Button variant="outline">Edit Workflow</Button>
        </Link>
      );
    },
  },

  {
    id: "actions",
    enableHiding: false,
    header: () => <div className="">Actions</div>,
    cell: ({ row }) => {
      return <WorkflowActions workflow={row.original} />;
    },
  },
];
