"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Globe, Radio, Zap, MonitorDot, LayoutList, Network, Database, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { RefreshIntervalSelector } from "@/components/refresh-interval-selector";
import { TimeRangeSelector } from "@/components/time-range-selector";

const navItems = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/ws", label: "WS Metrics", icon: Radio },
  { href: "/ws/live", label: "WS Live", icon: MonitorDot },
  { href: "/ws/rooms", label: "WS Rooms", icon: LayoutList },
  { href: "/ws/topology", label: "WS Topology", icon: Network },
  { href: "/http", label: "HTTP / API", icon: Globe },
  { href: "/eventsub", label: "EventSub", icon: Zap },
  { href: "/database", label: "Database", icon: Database },
];

export function MonitorSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-border flex flex-col">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <Activity className="h-5 w-5 text-chart-1" />
        <span className="font-semibold text-sm">StreamWizard Monitor</span>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              pathname === href || (href !== "/ws" && pathname.startsWith(href))
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-3 py-3 border-t border-border space-y-2">
        <TimeRangeSelector />
        <RefreshIntervalSelector />
      </div>
    </aside>
  );
}
