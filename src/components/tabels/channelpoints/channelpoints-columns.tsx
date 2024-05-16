"use client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import TruncatedText from "@/components/ui/truncated-text";
import { CommandsTable } from "@/types/database/command";
import { TwitchChannelPointsReward } from "@/types/API/twitch";
import ChannelPointSwitch from "./channelpoints-switch";
import ChannelPointActions from "./channelpoint-actions";

export const ChannelPointsColumns: ColumnDef<TwitchChannelPointsReward>[] = [
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
    cell: ({ row }) => <ChannelPointSwitch channelPoint={row.original} />,
    enableHiding: false,
    enableSorting: false,
  },
  {
    accessorKey: "title",
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Title
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => <div className="lowercase pl-4">{row.getValue("title")}</div>,
    enableHiding: true,
  },
  {
    accessorKey: "cost",
    header: () => <div className="">Cost</div>,
    cell: ({ row }) => {
      return <div className="font-medium capitalize">{row.getValue("cost")}</div>;
    },
  },
  {
    accessorKey: "prompt",
    header: () => <div className="">Prompt</div>,
    cell: ({ row }) => {
      const prompt = row.original.prompt

      return (
        prompt ? (
          <TruncatedText message={prompt} />
        ) : (
          <div className="font-medium capitalize">Not Set</div>
        )
      )
    },
  },

  {
    accessorKey: "global_cooldown_setting",
    header: () => <div className="">Global Cooldown</div>,
    cell: ({ row }) => {
      return <div className="font-medium capitalize">{row.original.global_cooldown_setting.global_cooldown_seconds} sec</div>;
    },
  },
  {
    accessorKey: "max_per_user_per_stream_setting",
    header: () => <div className="">Max Per User Per Stream</div>,
    cell: ({ row }) => {
      const max_per_user_per_stream = row.original.max_per_user_per_stream_setting.max_per_user_per_stream;
      return <div className=" font-medium capitalize">{max_per_user_per_stream ? max_per_user_per_stream : "not set"}</div>;
    },
  },
  {
    accessorKey: "max_per_stream_setting",
    header: () => <div className="">Max Per Stream</div>,
    cell: ({ row }) => {
      const max_per_stream = row.original.max_per_stream_setting.max_per_stream;
      return <div className=" font-medium capitalize">{max_per_stream ? max_per_stream :  "Not Set"}</div>;
    },
  },
  {
    accessorKey: "action",
    header: () => <div className="">Action</div>,
    cell: ({ row }) => {
      return <div className=" font-medium capitalize">{row.original.action}</div>;
    },
  },
  {
    accessorKey: "id",
    header: () => <div className="">ChannelPoint ID</div>,
    cell: ({ row }) => {
      return (
        <div className="font-medium">
          <p>{row.original.id}</p>
        </div>
      );
    },
  },

  {
    id: "actions",
    enableHiding: false,
    header: () => <></>,
    cell: ({ row }) => {
      return <ChannelPointActions channelPoint={row.original} />;
    },
  },
];
