"use client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import TruncatedText from "@/components/ui/truncated-text";
import { BannedChatter } from "@/types/database/banned-chatter";
import BannedChatterActions from "./banned-chatter-actions";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import TwitchCard from "@/components/hover-cards/twitch-card";

export const BannedChatterColumns: ColumnDef<BannedChatter>[] = [
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
    accessorKey: "chatter_name",
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Chatter Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      return (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button variant="link">{row.original.chatter_name}</Button>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <TwitchCard broadcaster_id={row.original.chatter_id} />
          </HoverCardContent>
        </HoverCard>
      );
    },

    enableHiding: true,
  },

  {
    accessorKey: "moderator_name",
    header: () => <div className="">Banned By</div>,
    cell: ({ row }) => {
      return (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button variant="link">{row.original.moderator_name}</Button>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <TwitchCard broadcaster_id={row.original.moderator_id} />
          </HoverCardContent>
        </HoverCard>
      );
    },
  },

  {
    accessorKey: "Banned_at",
    header: () => <div className="">Banned At</div>,
    cell: ({ row }) => {
      return <div className=" font-medium capitalize">{new Date(row.original.created_at!).toLocaleDateString()}</div>;
    },

    enableHiding: false,
  },

  {
    id: "actions",
    enableHiding: false,
    header: () => <div className="">Actions</div>,
    cell: ({ row }) => {
      const chatter = row.original;

      return <BannedChatterActions chatter={chatter} />;
    },
  },
];
