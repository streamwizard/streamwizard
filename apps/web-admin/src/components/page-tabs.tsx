"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { findNavLocation } from "@/lib/nav-config";
import { cn } from "@/lib/utils";

export interface PageTab {
  href: string;
  label: string;
  /** Match the path exactly; otherwise child paths keep the tab active. */
  exact?: boolean;
  /** Set by the caller when the active tab can't be read from the path (query-param views). */
  active?: boolean;
  count?: number | null;
  /** Amber count: something here is waiting on staff. */
  attention?: boolean;
  /** Amber dot: the feature behind this tab still needs setting up. */
  notSetUp?: boolean;
}

interface PageTabsProps {
  tabs: PageTab[];
  label: string;
  /** "underline" for the tabs of a page, "pills" for a second row or a filter. */
  variant?: "underline" | "pills";
  className?: string;
}

/**
 * The one tab row for the admin app. Each tab is a link, so it deep-links and
 * loads on its own. One scrolling row on phones; the active tab scrolls into
 * view.
 */
export function PageTabs({ tabs, label, variant = "underline", className }: PageTabsProps) {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  const isActive = (tab: PageTab) =>
    tab.active ?? (tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`));
  const activeHref = tabs.find(isActive)?.href;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeHref]);

  return (
    <nav
      aria-label={label}
      className={cn(
        "flex max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        variant === "underline" ? "gap-1 border-b" : "w-fit items-center gap-0.5 rounded-lg bg-muted p-[3px]",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = isActive(tab);
        return (
          <Link
            key={tab.href}
            ref={active ? activeRef : undefined}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 text-sm whitespace-nowrap transition-colors",
              "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              variant === "underline"
                ? cn(
                    "-mb-px h-11 border-b-2 px-3 md:h-10",
                    active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )
                : cn(
                    "h-9 rounded-md border border-transparent px-3 font-medium md:h-8",
                    active
                      ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30"
                      : "text-muted-foreground hover:text-foreground",
                  ),
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  tab.attention && tab.count > 0 ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-muted text-muted-foreground",
                )}
              >
                {tab.count}
              </span>
            )}
            {tab.notSetUp && (
              <>
                <span aria-hidden className="size-1.5 rounded-full bg-amber-500" />
                <span className="sr-only">(not set up)</span>
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The tab row of the current nav item, read from the nav config. Sits at the
 * top of every page of that item; hidden on detail pages that belong to none
 * of the tabs (a single ticket, for example).
 */
export function NavTabs({ notSetUp = [] }: { notSetUp?: string[] }) {
  const pathname = usePathname();
  const location = findNavLocation(pathname);
  if (!location?.item.tabs || !location.tab) return null;

  const gaps = new Set(notSetUp);
  return (
    <PageTabs
      label={`${location.item.label} sections`}
      className="mb-4 md:mb-6"
      tabs={location.item.tabs.map((tab) => ({
        href: tab.href,
        label: tab.label,
        active: tab === location.tab,
        notSetUp: gaps.has(tab.href),
      }))}
    />
  );
}
