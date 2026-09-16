"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity } from "lucide-react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarRail } from "@repo/ui";
import { NavUser } from "@/components/nav-user";
import { navGroups, isNavItemActive } from "@/lib/nav-config";

interface MonitorSidebarProps {
  userEmail: string;
  /** Hrefs of nav items whose feature is missing setup (e.g. no channel picked). */
  notSetUp?: string[];
}

export function MonitorSidebar({ userEmail, notSetUp = [] }: MonitorSidebarProps) {
  const pathname = usePathname();
  const gaps = new Set(notSetUp);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/overview">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Activity className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold text-sm">StreamWizard</span>
                  <span className="truncate text-xs text-muted-foreground">Admin</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const missing = gaps.has(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isNavItemActive(item, pathname)}
                        tooltip={missing ? `${item.label} · Not set up` : item.label}
                      >
                        <Link href={item.href}>
                          <span className="relative flex shrink-0">
                            <item.icon />
                            {missing && (
                              // Collapsed sidebar hides the badge, so the icon carries a dot instead.
                              <span
                                aria-hidden
                                className="absolute -top-0.5 -right-0.5 hidden size-1.5 rounded-full bg-amber-500 group-data-[collapsible=icon]:block"
                              />
                            )}
                          </span>
                          <span>{item.label}</span>
                          {missing && <span className="sr-only">(not set up)</span>}
                        </Link>
                      </SidebarMenuButton>
                      {missing && (
                        <SidebarMenuBadge className="rounded-full bg-amber-500/15 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                          Not set up
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser email={userEmail} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
