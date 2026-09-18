"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@repo/ui";

const BASE = "/discord/tickets/settings";

const TABS = [
  { href: BASE, label: "General" },
  { href: `${BASE}/panel`, label: "Panel" },
  { href: `${BASE}/categories`, label: "Categories" },
  { href: `${BASE}/products`, label: "Products" },
  { href: `${BASE}/messages`, label: "Messages" },
];

/** Section links across the top of every ticket settings page. */
export function TicketSettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Ticket settings" className="flex gap-1 overflow-x-auto border-b">
      {TABS.map((tab) => {
        const current = tab.href === BASE ? pathname === BASE : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
              current
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
