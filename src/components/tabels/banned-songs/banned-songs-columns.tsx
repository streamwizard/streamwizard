"use client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import BannedChatterActions from "./banned-songs-actions";
import { SpotifyBannedSongsTable } from "@/types/database";

export const BannedSongsColumns: ColumnDef<SpotifyBannedSongsTable>[] = [
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
    accessorKey: "song_name",
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Song name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      return <span>{row.original.song_name}</span>;
    },

    enableHiding: true,
  },

  {
    accessorKey: "artists",
    header: () => <div className="">Artists</div>,
    cell: ({ row }) => {
      return <span>{row.original.artists}</span>;
    },
  },

  {
    accessorKey: "Banned_at",
    header: () => <div className="">Banned At</div>,
    cell: ({ row }) => {
      return <div className="font-medium capitalize">{new Date(row.original.created_at!).toLocaleDateString()}</div>;
    },

    enableHiding: false,
  },

  {
    id: "actions",
    enableHiding: false,
    header: () => <div className="">Actions</div>,
    cell: ({ row }) => {
      const chatter = row.original;

      return <BannedChatterActions song={chatter} />;
    },
  },
];
