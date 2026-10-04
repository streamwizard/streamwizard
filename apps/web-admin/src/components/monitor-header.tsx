"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, SlidersHorizontal } from "lucide-react";
import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Popover, PopoverContent, PopoverTrigger, Separator, SidebarTrigger } from "@repo/ui";
import { RefreshIntervalSelector } from "@/components/refresh-interval-selector";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { BandwidthUnitToggle } from "@/components/bandwidth-unit-toggle";
import { usePageCrumbs } from "@/lib/crumbs";
import { findNavLocation, getHeaderControls, getNavTrail, type HeaderControl } from "@/lib/nav-config";
import { cn } from "@/lib/utils";

const ENV_BADGE_CLASSES: Record<string, string> = {
  prod: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
  staging: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  dev: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

function HeaderControls({ controls }: { controls: HeaderControl[] }) {
  return (
    <>
      {controls.includes("bandwidth") && <BandwidthUnitToggle />}
      {controls.includes("range") && <TimeRangeSelector />}
      {controls.includes("refresh") && <RefreshIntervalSelector />}
    </>
  );
}

export function MonitorHeader({ envLabel }: { envLabel: string }) {
  const pathname = usePathname();
  const location = findNavLocation(pathname);
  const controls = getHeaderControls(location);
  const pageCrumbs = usePageCrumbs();
  const trail = [...getNavTrail(location), ...pageCrumbs];
  const current = trail.at(-1);
  // Phones show one level, so a detail page needs a way back up.
  const parent = pageCrumbs.length > 0 ? trail.slice(0, -1).reverse().find((crumb) => crumb.href) : undefined;

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      {/* The bottom bar's "More" opens the menu on phones. */}
      <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
      <Separator orientation="vertical" className="mr-1 hidden !h-4 md:block" />

      {parent?.href && (
        <Button variant="ghost" size="icon" className="-ml-2 size-10 shrink-0 md:hidden" asChild>
          <Link href={parent.href} aria-label={`Back to ${parent.label}`}>
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
        </Button>
      )}
      <p className="min-w-0 truncate text-sm font-medium md:hidden">{current?.label ?? "Admin"}</p>

      <Breadcrumb className="hidden min-w-0 md:block">
        <BreadcrumbList className="flex-nowrap">
          {trail.length === 0 && (
            <BreadcrumbItem>
              <BreadcrumbPage>Admin</BreadcrumbPage>
            </BreadcrumbItem>
          )}
          {trail.map((crumb, index) => {
            const last = index === trail.length - 1;
            return (
              <Fragment key={`${crumb.href ?? "group"}-${crumb.label}`}>
                <BreadcrumbItem className={cn(last ? "min-w-0" : "shrink-0")}>
                  {last ? (
                    <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                  ) : crumb.href ? (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    crumb.label
                  )}
                </BreadcrumbItem>
                {!last && <BreadcrumbSeparator />}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex shrink-0 items-center gap-3">
        {controls.length > 0 && (
          <>
            <div className="hidden items-center gap-3 md:flex">
              <HeaderControls controls={controls} />
            </div>
            {/* Phones: the same controls behind one button. */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 md:hidden">
                  <SlidersHorizontal className="size-4" aria-hidden />
                  View
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="flex w-auto flex-col items-end gap-3">
                <HeaderControls controls={controls} />
              </PopoverContent>
            </Popover>
          </>
        )}
        <Badge variant="outline" className={cn("uppercase", ENV_BADGE_CLASSES[envLabel])}>
          {envLabel}
        </Badge>
      </div>
    </header>
  );
}
