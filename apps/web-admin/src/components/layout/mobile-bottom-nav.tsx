"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useSidebar } from "@repo/ui";
import { useNavCounts } from "@/hooks/use-nav-counts";
import { BOTTOM_NAV_HREFS, findNavItem, findNavLocation, type NavItem } from "@/lib/nav-config";
import { cn } from "@/lib/utils";

// Shorter than the sidebar label where five slots across a phone need it.
const SHORT_LABELS: Record<string, string> = { "/overview": "Home" };

const ITEMS = BOTTOM_NAV_HREFS.map(findNavItem).filter((item): item is NavItem => item !== null);

const SLOT_CLASS =
  "relative flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground transition-colors focus-visible:bg-accent focus-visible:outline-none aria-[current=page]:text-foreground";

/**
 * Phone navigation: the four places an admin goes most, plus "More" for the
 * full menu. Hidden with CSS from 768px up, where the sidebar takes over.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const counts = useNavCounts();
  const { toggleSidebar } = useSidebar();
  const activeItem = findNavLocation(pathname)?.item;
  const elsewhere = !ITEMS.some((item) => item === activeItem);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const count = item.badge ? counts[item.badge] : 0;
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={item === activeItem ? "page" : undefined} className={SLOT_CLASS}>
                <span className="relative">
                  <item.icon className="size-5" aria-hidden />
                  {count > 0 && (
                    <span
                      className={cn(
                        "absolute -top-1.5 left-3 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums text-white",
                        item.badge === "alerts" ? "bg-destructive" : "bg-amber-600",
                      )}
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </span>
                {SHORT_LABELS[item.href] ?? item.label}
                {count > 0 && <span className="sr-only">({count} waiting)</span>}
              </Link>
            </li>
          );
        })}
        <li>
          <button type="button" onClick={toggleSidebar} aria-current={elsewhere ? "page" : undefined} className={SLOT_CLASS}>
            <Menu className="size-5" aria-hidden />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
