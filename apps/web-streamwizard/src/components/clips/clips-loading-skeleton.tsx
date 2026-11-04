"use client";

import { useSearchParams } from "next/navigation";
import { ClipsDetailsSkeleton, ClipsGridSkeleton } from "@/components/clips/clips-skeleton";
import { parseClipView } from "@/lib/utils/clip-view";

export function ClipsLoadingSkeleton() {
  const searchParams = useSearchParams();
  const view = parseClipView(searchParams.get("view") ?? undefined);

  return view === "details" ? <ClipsDetailsSkeleton /> : <ClipsGridSkeleton />;
}
