import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui";
import { useModal } from "@/providers/modal-provider";
import { useSession } from "@/providers/session-provider";
import { Database } from "@repo/supabase";
import {
  buildClipFolderTree,
  getActiveFolderHref,
  getFolderUrl,
  type ClipFolderNode,
} from "@/lib/utils/clip-folders";
import { cn } from "@/lib/utils";
import { Clapperboard, ChevronRight, EllipsisVertical, Folder, FolderOpen, Plus } from "lucide-react";
import Link from "next/link";
import { ClipFolderModal } from "../modals/clip-folder-modal";
import { Button } from "@repo/ui";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@repo/ui";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@repo/ui";
import ClipFolderDeleteModal from "../modals/clip-folder-delete-modal";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const BRANCH_TOP = 15;
const INDENT_COLUMN_WIDTH = 12;

function isFolderPathActive(folder: ClipFolderNode, activeFolderHref: string | null): boolean {
  if (!activeFolderHref) return false;
  if (folder.href === activeFolderHref) return true;
  return folder.children.some((child) => isFolderPathActive(child, activeFolderHref));
}

interface Props {
  clipFolders: Database["public"]["Tables"]["clip_folders"]["Row"][];
}

type FolderTreeHandlers = {
  activeFolderHref: string | null;
  onCreateSubfolder: (folder: ClipFolderNode) => void;
  onEditFolder: (folder: ClipFolderNode) => void;
  onDeleteFolder: (folder: ClipFolderNode) => void;
};

function FolderTreeIndent({ guides, isLast }: { guides: boolean[]; isLast: boolean }) {
  const depth = guides.length;
  if (depth === 0) return null;

  const line = "bg-sidebar-foreground/25";

  return (
    <span className="flex shrink-0 self-stretch" aria-hidden>
      {Array.from({ length: depth }, (_, index) => {
        const isCorner = index === depth - 1;

        return (
          <span
            key={index}
            className="relative shrink-0 self-stretch"
            style={{ width: INDENT_COLUMN_WIDTH }}
          >
            {!isCorner && guides[index] && !isLast ? (
              <span className={cn("absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2", line)} />
            ) : null}
            {isCorner ? (
              <>
                <span
                  className={cn(
                    "absolute left-1/2 w-px -translate-x-1/2",
                    line,
                    isLast ? "top-0" : "top-0 bottom-0"
                  )}
                  style={isLast ? { height: BRANCH_TOP } : undefined}
                />
                <span className={cn("absolute left-1/2 top-[15px] h-px w-1/2", line)} />
              </>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

function FolderTreeNode({
  folder,
  guides,
  isLast,
  activeFolderHref,
  onCreateSubfolder,
  onEditFolder,
  onDeleteFolder,
}: {
  folder: ClipFolderNode;
  guides: boolean[];
  isLast: boolean;
} & FolderTreeHandlers) {
  const [isOpen, setIsOpen] = useState(true);
  const isActive = activeFolderHref === folder.href;
  useEffect(() => {
    if (isFolderPathActive(folder, activeFolderHref)) {
      setIsOpen(true);
    }
  }, [activeFolderHref, folder]);

  const hasChildren = folder.children.length > 0;
  const folderUrl = getFolderUrl(folder.href);

  return (
    <li className="relative list-none">
      <div className="group/folder-row relative flex min-w-0 items-center rounded-md hover:bg-sidebar-accent">
        <FolderTreeIndent guides={guides} isLast={isLast} />
        <div className="flex w-5 shrink-0 items-center justify-center">
          {hasChildren ? (
            <button
              type="button"
              className="flex size-5 items-center justify-center rounded-sm text-sidebar-foreground/70 hover:text-sidebar-foreground"
              onClick={() => setIsOpen((open) => !open)}
              aria-label={isOpen ? "Collapse folder" : "Expand folder"}
            >
              <ChevronRight className={cn("size-3.5 transition-transform", isOpen && "rotate-90")} />
            </button>
          ) : null}
        </div>
        <Link
          href={folderUrl}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1.5 pr-1",
            guides.length > 0 ? "text-[13px]" : "text-sm",
            isActive
              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:text-sidebar-accent-foreground"
          )}
        >
          {isActive ? <FolderOpen className="size-3.5 shrink-0" /> : <Folder className="size-3.5 shrink-0" />}
          <span className="truncate">{folder.name}</span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 opacity-0 transition-opacity group-hover/folder-row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
            >
              <EllipsisVertical className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Folder Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onCreateSubfolder(folder)}>New subfolder</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEditFolder(folder)}>Rename</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDeleteFolder(folder)}>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {hasChildren && isOpen ? (
        <ul className="list-none">
          {folder.children.map((child, index) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              guides={[...guides, !isLast]}
              isLast={index === folder.children.length - 1}
              activeFolderHref={activeFolderHref}
              onCreateSubfolder={onCreateSubfolder}
              onEditFolder={onEditFolder}
              onDeleteFolder={onDeleteFolder}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function SidebarClips({ clipFolders }: Props) {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const pathname = usePathname();
  const { openModal } = useModal();
  const { id } = useSession();
  const activeFolderHref = getActiveFolderHref(pathname, clipFolders);
  const folderTree = buildClipFolderTree(clipFolders);
  const isClipsActive = pathname === "/dashboard/clips";

  useEffect(() => {
    if (activeFolderHref) {
      setIsOpen(true);
    }
  }, [activeFolderHref]);

  const createFolderButton = (parentFolder?: ClipFolderNode) => {
    openModal(
      <ClipFolderModal
        user_id={id}
        parent_folder_id={parentFolder?.id}
        parent_folder_name={parentFolder?.name}
      />
    );
  };

  const editFolderButton = (folder: ClipFolderNode) => {
    openModal(<ClipFolderModal user_id={id} folder_id={folder.id} folder_name={folder.name} />);
  };

  const deleteFolderButton = (folder: ClipFolderNode) => {
    openModal(
      <ClipFolderDeleteModal folderId={folder.id} folderName={folder.name} hasSubfolders={folder.children.length > 0} />
    );
  };

  const folderHandlers: FolderTreeHandlers = {
    activeFolderHref,
    onCreateSubfolder: createFolderButton,
    onEditFolder: editFolderButton,
    onDeleteFolder: deleteFolderButton,
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isClipsActive && !activeFolderHref}>
        <Link href="/dashboard/clips">
          <Clapperboard className="mr-2 h-4 w-4" />
          Clips
        </Link>
      </SidebarMenuButton>

      <SidebarMenuSub className="border-0">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <SidebarMenuSubItem>
            <div className="flex min-w-0 items-center gap-0.5">
              <CollapsibleTrigger asChild>
                <SidebarMenuSubButton isActive={!!activeFolderHref} className="min-w-0 flex-1">
                  {isOpen ? <FolderOpen /> : <Folder />}
                  <span>Folders</span>
                  <ChevronRight className={cn("ml-auto size-3.5 shrink-0 transition-transform", isOpen && "rotate-90")} />
                </SidebarMenuSubButton>
              </CollapsibleTrigger>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                onClick={() => createFolderButton()}
              >
                <Plus className="size-3.5" />
                <span className="sr-only">Create new folder</span>
              </Button>
            </div>

            <CollapsibleContent className="outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
              <ul className="list-none py-0.5">
                {folderTree.map((folder, index) => (
                  <FolderTreeNode
                    key={folder.id}
                    folder={folder}
                    guides={[]}
                    isLast={index === folderTree.length - 1}
                    {...folderHandlers}
                  />
                ))}
              </ul>
            </CollapsibleContent>
          </SidebarMenuSubItem>
        </Collapsible>
      </SidebarMenuSub>
    </SidebarMenuItem>
  );
}
