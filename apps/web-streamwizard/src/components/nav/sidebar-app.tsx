"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui";
import { discordInviteLink } from "@/lib/constant";
import { Database } from "@repo/supabase";
import { User } from "@supabase/supabase-js";
import { BarChart2, FileVideoCamera, Layers } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FaDiscord } from "react-icons/fa";
import { Separator } from "@repo/ui";
import { DashboardUserNav } from "./dashboard-user-nav";
import SidebarClips from "./sidebar-clips";
import SidebarCommands from "./sidebar-commands";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: User;
  folders: Database["public"]["Tables"]["clip_folders"]["Row"][];
}

export function AppSidebar({ user, folders, ...props }: AppSidebarProps) {
  return (
    <Sidebar className="h-full" {...props}>
      <SidebarHeader>
        <div className="flex flex-row items-center gap-2 px-4 mt-4 justify-center">
          <Image
            src="/logo.png"
            width={100}
            height={100}
            alt="Logo"
            style={{ width: 100, height: 100 }}
            priority
          />
        </div>
        <span className="my-4">
          <Separator />
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard">
                    <BarChart2 className="mr-2 h-4 w-4" />
                    Stream Analytics
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Clips</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard/vods">
                    <FileVideoCamera className="mr-2 h-4 w-4" />
                    Vods
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarClips clipFolders={folders} />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Overlays</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard/overlays">
                    <Layers className="mr-2 h-4 w-4" />
                    Overlay Editor
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Commands</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarCommands />
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
