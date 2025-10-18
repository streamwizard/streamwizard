import { Clapperboard, Command } from "lucide-react";
import Link from "next/link";
import { Collapsible } from "../ui/collapsible";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";

export default function SidebarCommands() {
  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/dashboard/default-commands">
              <Command className="mr-2 h-4 w-4" />
              Default Commands
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  );
}
