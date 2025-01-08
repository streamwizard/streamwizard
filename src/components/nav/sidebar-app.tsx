"use client";
import { Clapperboard } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { User } from "@supabase/supabase-js";
import Image from "next/image";
import { Separator } from "../ui/separator";
import { DashboardUserNav } from "./DashboardUserNav";
import SidebarClips from "./sidebar-clips";
import { Database } from "@/types/supabase";
import Link from "next/link";
import { discordInviteLink } from "@/lib/constant";
import { FaDiscord } from "react-icons/fa";

// Menu items.
const items = [
  {
    title: "Clips",
    url: "/dashboard/",
    icon: Clapperboard,
  },
];

interface AppSidebarProps {
  user: User;
  folders: Database["public"]["Tables"]["clip_folders"]["Row"][];
}

export function AppSidebar({ user, folders }: AppSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex flex-row items-center gap-2 px-4 mt-4 justify-center">
          <Image
            src="/logo.png"
            width={100}
            height={100}
            alt="Logo"
            style={{
              maxWidth: "100%",
              height: "auto",
            }}
            priority
          />
        </div>
        <span className="my-4">
          <Separator />
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Clips</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarClips clipFolders={folders} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link
                href={discordInviteLink}
                target="_blank"
                className="items flex h-8 w-full select-none items-center justify-between rounded-md pl-3 pr-3 text-sm text-muted-foreground transition hover:cursor-pointer hover:bg-border/50 "
              >
                <div className="flex flex-row items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full ">
                    <FaDiscord className="h-4 w-4 text-[#002bff]" />
                  </div>
                  <p className="text-sm font-medium leading-none">Discord Community</p>
                </div>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <DashboardUserNav profile_img={user.user_metadata.avatar_url} username={user.user_metadata.full_name} />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </SidebarFooter>
    </Sidebar>
  );
}
