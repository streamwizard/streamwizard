import type { Metadata } from "next";
import { Suspense } from "react";
import { ObsViewerContent } from "@/components/irl/obs-viewer-content";

export const metadata: Metadata = {
  title: "OBS desktop",
};

export default function ObsViewerPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-black" />}>
      <ObsViewerContent />
    </Suspense>
  );
}
