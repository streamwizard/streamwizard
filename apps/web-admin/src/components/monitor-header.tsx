"use client";

import { usePathname } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Popover, PopoverContent, PopoverTrigger, Separator, SidebarTrigger } from "@repo/ui";
import { RefreshIntervalSelector } from "@/components/refresh-interval-selector";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { BandwidthUnitToggle } from "@/components/bandwidth-unit-toggle";
import { findNavLocation, type HeaderControl } from "@/lib/nav-config";
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
  const controls = location?.item.controls ?? [];

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 !h-4" />
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap">
          {location && location.group.label !== location.item.label && (
            <>
              <BreadcrumbItem className="hidden sm:block text-muted-foreground">
                {location.group.label}
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:block" />
            </>
          )}
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="truncate">{location?.item.label ?? "Admin"}</BreadcrumbPage>
          </BreadcrumbItem>
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
