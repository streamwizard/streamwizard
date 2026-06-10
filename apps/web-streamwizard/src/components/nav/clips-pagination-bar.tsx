"use client";

import { AdvancedPagination } from "@/components/nav/advanced-pagination";
import {
  CLIP_PAGE_SIZE_OPTIONS,
  getClipPageRange,
  type ClipPageSize,
} from "@/lib/utils/clip-pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ClipsPaginationBarProps = {
  totalPages: number;
  currentPage: number;
  pageSize: ClipPageSize;
  totalCount: number;
  showingCount: number;
  placement?: "top" | "bottom";
};

export function ClipsPaginationBar({
  totalPages,
  currentPage,
  pageSize,
  totalCount,
  showingCount,
  placement = "bottom",
}: ClipsPaginationBarProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const { from, to } = getClipPageRange(currentPage, pageSize, showingCount, totalCount);

  const changePageSize = (size: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("per_page", size);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card/50 px-3 py-2",
        placement === "top" ? "mb-4" : "mt-6"
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdvancedPagination totalPages={totalPages} initialPage={currentPage} />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Clips per page</span>
            <Select value={String(pageSize)} onValueChange={changePageSize}>
              <SelectTrigger className="h-8 w-20 bg-background text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIP_PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground whitespace-nowrap">
            Showing {from}–{to} of {totalCount} clips
          </p>
        </div>
      </div>
    </div>
  );
}
