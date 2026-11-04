"use client";

import { Suspense } from "react";
import { ObsViewerContent } from "@/components/irl/obs-viewer-content";

export default function ObsViewerPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-black" />}>
      <ObsViewerContent />
    </Suspense>
  );
}
