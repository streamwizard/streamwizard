"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface UserTab {
  /** Path under /users/[id]; "" is the overview. */
  segment: string;
  label: string;
  count?: number | null;
}

/** The detail page's section nav. Each tab is its own route, so it deep-links and loads on its own. */
export function UserTabs({ userId, tabs }: { userId: string; tabs: UserTab[] }) {
  const pathname = usePathname();
  const base = `/users/${userId}`;

  return (
    <nav aria-label="User sections" className="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-lg bg-muted p-[3px]">
      {tabs.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const active = tab.segment ? pathname.startsWith(href) : pathname === base;
        return (
          <Link
            key={tab.segment}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border border-transparent px-3 text-sm font-medium whitespace-nowrap transition-colors",
              "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              active
                ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">{tab.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
