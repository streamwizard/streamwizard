"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui";
import { useClipFolderDialog } from "@/providers/clip-folder-dialog-provider";
import { formatFolderClipCount, getFolderUrl, type FolderClipCount } from "@/lib/utils/clip-folders";
import { EllipsisVertical, Folder, Plus } from "lucide-react";
import Link from "next/link";

export type FolderOverviewRow = {
  id: string;
  name: string;
  href: string;
  /** Nesting level, 0 for a root folder. */
  depth: number;
  hasSubfolders: boolean;
  count: FolderClipCount;
};

const INDENT_PER_LEVEL = 20;

export function FoldersOverview({ rows }: { rows: FolderOverviewRow[] }) {
  const { openCreateFolder, openRenameFolder, openDeleteFolder } = useClipFolderDialog();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Folders</h1>
          <p className="mt-2 text-muted-foreground">Every folder and subfolder, and how many clips are in each.</p>
        </div>
        {rows.length > 0 ? (
          <Button onClick={() => openCreateFolder()}>
            <Plus className="mr-2 size-4" />
            New folder
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border py-16 text-center">
          <Folder className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">No folders yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">Your clips are all in one big pile. Start sorting.</p>
          </div>
          <Button onClick={() => openCreateFolder()}>
            <Plus className="mr-2 size-4" />
            New folder
          </Button>
        </div>
      ) : (
        <ul className="list-none divide-y divide-border">
          {rows.map((row) => {
            const { label, aria } = formatFolderClipCount(row.count);

            return (
              <li key={row.id} className="group/folder-row relative flex items-center hover:bg-accent/50">
                <Link
                  href={getFolderUrl(row.href)}
                  className="flex min-w-0 flex-1 items-center gap-2 py-3 pr-2"
                  style={{ paddingLeft: row.depth * INDENT_PER_LEVEL }}
                >
                  <Folder className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{row.name}</span>
                  <span
                    className="ml-auto shrink-0 font-mono text-xs tabular-nums text-muted-foreground"
                    aria-label={aria}
                  >
                    {label}
                  </span>
                </Link>

                {/* Visible on touch, hover-revealed on desktop, mirroring the sidebar rows. */}
                <div className="flex shrink-0 items-center gap-px pr-1 opacity-100 transition-opacity focus-within:opacity-100 has-[[data-state=open]]:opacity-100 md:opacity-0 md:group-hover/folder-row:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => openCreateFolder(row.id, row.name)}
                  >
                    <Plus className="size-3.5" />
                    <span className="sr-only">New subfolder in {row.name}</span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="size-7">
                        <EllipsisVertical className="size-3.5" />
                        <span className="sr-only">Folder actions for {row.name}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Folder Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openCreateFolder(row.id, row.name)}>
                        New subfolder
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openRenameFolder(row.id, row.name)}>Rename</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openDeleteFolder(row.id, row.name, row.hasSubfolders)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
