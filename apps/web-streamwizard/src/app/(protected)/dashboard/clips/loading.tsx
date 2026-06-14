"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ClipsDetailsSkeleton, ClipsGridSkeleton } from "@/components/clips/clips-skeleton";
import { parseClipView } from "@/lib/utils/clip-view";

function ClipsLoadingSkeleton() {
  const searchParams = useSearchParams();
  const view = parseClipView(searchParams.get("view") ?? undefined);

  return view === "details" ? <ClipsDetailsSkeleton /> : <ClipsGridSkeleton />;
}

export default function Loading() {
  return (
    <Suspense fallback={<ClipsGridSkeleton />}>
      <ClipsLoadingSkeleton />
    </Suspense>
  );
}
