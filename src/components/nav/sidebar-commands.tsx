import { Clapperboard, Command } from "lucide-react";
import Link from "next/link";
import { Collapsible } from "../ui/collapsible";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { Badge } from "@/components/ui/badge"

export default function SidebarCommands() {
  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild disabled>
            <Link href="#" >
              <Command className="mr-2 h-4 w-4" />
              Default Commands
              <Badge variant="secondary" className="ml-2">Soon</Badge>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  );
}
