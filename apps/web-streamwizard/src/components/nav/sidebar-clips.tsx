import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useModal } from "@/providers/modal-provider";
import { useSession } from "@/providers/session-provider";
import { Database } from "@/types/supabase";
import { Clapperboard, EllipsisVertical, Folder, Plus, FolderOpen } from "lucide-react";
import Link from "next/link";
import { CLipFolderModal } from "../modals/clip-folder-modal";
import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem } from "../ui/sidebar";

import ClipFolderDeleteModal from "../modals/clip-folder-delete-modal";
import { useState } from "react";
import { usePathname } from "next/navigation";

interface Props {
  clipFolders: Database["public"]["Tables"]["clip_folders"]["Row"][];
}

export default function SidebarClips({ clipFolders }: Props) {
  const [isOpen, setIsOpen] = useState<boolean>(true); // Manage collapsible state manually
  const pathname = usePathname();
  const { openModal } = useModal();
  const { id } = useSession();

  const createFolderButton = () => {
    openModal(<CLipFolderModal user_id={id} />);
  };

  const EditFolderButton = (folderName: string, folderId: number) => {
    openModal(<CLipFolderModal user_id={id} folder_id={folderId} folder_name={folderName} />);
  };

  const deleteFolderButton = (folderId: number, folderName: string) => {
    openModal(<ClipFolderDeleteModal folderId={folderId} folderName={folderName} />);
  };

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/dashboard/clips">
              <Clapperboard className="mr-2 h-4 w-4" />
              Clips
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <Collapsible
          className="group/collapsible"
          onOpenChange={setIsOpen} // Track open/close state
          open={isOpen}
        >
          <SidebarMenuItem>
            <div className="flex">
              <CollapsibleTrigger asChild>
                <SidebarMenuButton className="flex justify-between">
                  <div className="flex items-center space-x-2">
                    {isOpen ? <FolderOpen className="mr-2 h-4 w-4" /> : <Folder className="mr-2 h-4 w-4" />}
                    Folders
                  </div>
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={createFolderButton}>
                <Plus /> <span className="sr-only">Create new folder</span>
              </Button>
            </div>

            <CollapsibleContent className="text-popover-foreground outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2">
              <SidebarMenuSub>
                {clipFolders.map((folder) => (
                  <SidebarMenuSubItem key={folder.id} className="flex items-center">
                    <SidebarMenuButton asChild isActive={pathname === `/dashboard/clips/${folder.href}`}>
                      <Link href={`/dashboard/clips/${folder.href}`} className="flex items-center space-x-2">
                        {pathname === `/dashboard/clips/${folder.href}` ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
                        {folder.name}
                      </Link>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <EllipsisVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Folder Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => EditFolderButton(folder.name, folder.id)}>Rename</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteFolderButton(folder.id, folder.name)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      </SidebarMenu>
    </>
  );
}
