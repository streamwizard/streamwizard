"use client";

import { Suspense } from "react";
import { ClipsGridSkeleton } from "@/components/clips/clips-skeleton";
import { ClipsLoadingSkeleton } from "@/components/clips/clips-loading-skeleton";

export default function Loading() {
  return (
    <Suspense fallback={<ClipsGridSkeleton />}>
      <ClipsLoadingSkeleton />
    </Suspense>
  );
}
