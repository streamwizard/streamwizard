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
import { Clapperboard, EllipsisVertical, Folder, Plus, Star } from "lucide-react";
import Link from "next/link";
import { CLipFolderModal } from "../modals/clip-folder-modal";
import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem } from "../ui/sidebar";

import { useState } from "react";
import ClipFolderDelete from "../alerts/clip-folder-delete";

interface Props {
  clipFolders: Database["public"]["Tables"]["clip_folders"]["Row"][];
}

export default function SidebarClips({ clipFolders }: Props) {
  const [showAlert, setShowAlert] = useState(false);
  const { openModal } = useModal();
  const { id } = useSession();

  const createFolderButton = () => {
    openModal(<CLipFolderModal user_id={id} />);
  };

  const EditFolderButton = (folderName: string, folderId: number) => {
    openModal(<CLipFolderModal user_id={id} folder_id={folderId} folder_name={folderName} />);
  };

  const deleteFolderButton = (folderId: number) => {
    openModal(
      <ClipFolderDelete
        folderId={folderId}
        open={true}
        setOpen={setShowAlert}
        userId={id}
      />
    )
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
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarMenuItem>
            <div className="flex">
              <CollapsibleTrigger asChild>
                <SidebarMenuButton className="flex justify-between">
                  <div className="flex items-center space-x-2">
                    <Folder className="mr-2 h-4 w-4" />
                    Folders
                  </div>
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={createFolderButton}>
                <Plus /> <span className="sr-only">Create new folder</span>
              </Button>
            </div>

            <CollapsibleContent>
              <SidebarMenuSub>
                {clipFolders.map((folder) => (
                  <SidebarMenuSubItem key={folder.id} className="flex items-center">
                    <SidebarMenuButton asChild>
                      <Link href={`/dashboard/clips/${folder.href}`} className="flex items-center space-x-2">
                        <Star className="mr-2 h-4 w-4" />
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
                        <DropdownMenuItem onClick={() => deleteFolderButton(folder.id)}>Delete</DropdownMenuItem>
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
