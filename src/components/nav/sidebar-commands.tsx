import { CircleDotDashed, Clapperboard, Folder, FolderOpen, Wand } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem } from "../ui/sidebar";

export default function StreamwizardSMP() {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const pathname = usePathname();
  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/dashboard/clips">
              <Clapperboard className="mr-2 h-4 w-4" />
              Streamwizard SMP
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
                    Admin
                  </div>
                </SidebarMenuButton>
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent className="text-popover-foreground outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2">
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuButton asChild isActive={pathname === `/dashboard/smp/admin/channel-points`}>
                    <Link href={`/dashboard/smp/admin/channel-points`} className="flex items-center space-x-2">
                      {<CircleDotDashed className="h-4 w-4" />}
                      Channel Points
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuButton asChild isActive={pathname === `/dashboard/smp/admin/actions`}>
                    <Link href={`/dashboard/smp/admin/actions`} className="flex items-center space-x-2">
                      {<Wand  className="h-4 w-4" />}
                      Action
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      </SidebarMenu>
    </>
  );
}
