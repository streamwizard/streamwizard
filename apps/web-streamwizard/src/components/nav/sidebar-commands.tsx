import { Badge } from "@repo/ui";
import { Command } from "lucide-react";
import Link from "next/link";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@repo/ui";

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
