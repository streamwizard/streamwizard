"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity } from "lucide-react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar } from "@repo/ui";
import { NavUser } from "@/components/nav-user";
import { useNavCounts } from "@/hooks/use-nav-counts";
import { navGroups, findNavLocation, type NavBadge } from "@/lib/nav-config";
import { cn } from "@/lib/utils";

interface MonitorSidebarProps {
  userEmail: string;
  /** Hrefs of pages whose feature is missing setup (e.g. no channel picked). */
  notSetUp?: string[];
}

// Alerts are the only counter that means "something is broken"; the others are a queue.
const COUNT_BADGE_CLASS: Record<NavBadge, string> = {
  alerts: "bg-destructive/15 text-destructive",
  tickets: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  widgets: "bg-muted text-muted-foreground",
};

const COUNT_DOT_CLASS: Record<NavBadge, string> = {
  alerts: "bg-destructive",
  tickets: "bg-amber-500",
  widgets: "bg-muted-foreground",
};

export function MonitorSidebar({ userEmail, notSetUp = [] }: MonitorSidebarProps) {
  const pathname = usePathname();
  const gaps = new Set(notSetUp);
  const counts = useNavCounts();
  const activeItem = findNavLocation(pathname)?.item;
  const { setOpenMobile } = useSidebar();

  // The phone drawer covers the page, so it has to get out of the way once a
  // link was followed.
  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

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
                  // A gap on any tab of the item counts: the tab row shows which one.
                  const missing = gaps.has(item.href) || (item.tabs?.some((tab) => gaps.has(tab.href)) ?? false);
                  const count = item.badge ? counts[item.badge] : 0;
                  const dotClass = missing ? "bg-amber-500" : item.badge && count > 0 ? COUNT_DOT_CLASS[item.badge] : null;
                  const note = missing ? "Not set up" : count > 0 ? `${count}` : null;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={item === activeItem}
                        tooltip={note ? `${item.label} · ${note}` : item.label}
                        className="h-11 md:h-8"
                      >
                        <Link href={item.href}>
                          <span className="relative flex shrink-0">
                            <item.icon />
                            {dotClass && (
                              // Collapsed sidebar hides the badge, so the icon carries a dot instead.
                              <span
                                aria-hidden
                                className={cn(
                                  "absolute -top-0.5 -right-0.5 hidden size-1.5 rounded-full group-data-[collapsible=icon]:block",
                                  dotClass,
                                )}
                              />
                            )}
                          </span>
                          <span>{item.label}</span>
                          {missing && <span className="sr-only">(not set up)</span>}
                        </Link>
                      </SidebarMenuButton>
                      {missing ? (
                        <SidebarMenuBadge className="rounded-full bg-amber-500/15 text-[10px] font-medium text-amber-700 peer-data-[size=default]/menu-button:top-2.5 md:peer-data-[size=default]/menu-button:top-1.5 dark:text-amber-400">
                          Not set up
                        </SidebarMenuBadge>
                      ) : (
                        item.badge &&
                        count > 0 && (
                          <SidebarMenuBadge
                            className={cn(
                              "rounded-full peer-data-[size=default]/menu-button:top-2.5 md:peer-data-[size=default]/menu-button:top-1.5",
                              COUNT_BADGE_CLASS[item.badge],
                            )}
                          >
                            {count}
                          </SidebarMenuBadge>
                        )
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
